import "server-only";
import { createClient } from "@/lib/supabase/server";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/applications/types";
import type { JobSponsorMatchStatus } from "@/lib/jobs/sponsor-match";

// Every number here comes from this user's own applications/
// application_status_history rows — RLS (`auth.uid() = user_id`)
// already scopes both, and the explicit `.eq("user_id", ...)` below is
// defence in depth, same as every other query in this app. "Use real
// user data" means exactly that: with zero applications, every rate
// here is `null` (not 0%, not a guessed placeholder), and every count
// is 0 — an honest empty state, not a fabricated example.

export type ApplicationFunnelStage = {
  status: ApplicationStatus;
  /** Applications *currently* at this status right now. */
  currentCount: number;
  /** Applications that have *ever* reached this status, per application_status_history — a later application_status_history row moving one to a different status doesn't remove it from an earlier stage it genuinely passed through. */
  everReachedCount: number;
};

export type ApplicationStageConversion = {
  from: ApplicationStatus;
  to: ApplicationStatus;
  fromCount: number;
  toCount: number;
  /** 0-100, or null when fromCount is 0 — never a fabricated 0%, which would misleadingly read as "none converted" rather than "no data yet". */
  rate: number | null;
};

export type ApplicationSponsorSplitEntry = {
  status: JobSponsorMatchStatus | "not_checked";
  count: number;
  percentage: number;
};

export type ApplicationFunnelAnalytics = {
  totalApplications: number;
  /** In APPLICATION_STATUSES order (Wishlist → Withdrawn). */
  byStage: ApplicationFunnelStage[];
  /** The three adjacent pairs in the core progression funnel — wishlist→applied, applied→interview, interview→offer. Rejected/Withdrawn are exits, not further funnel stages, so they're not part of this chain (they still appear in byStage). */
  stageConversions: ApplicationStageConversion[];
  /** Ever reached Interview ÷ ever reached Applied — the standard "did applying lead to an interview" rate. Null with no applications reached yet. */
  interviewRate: number | null;
  /** Ever reached Offer ÷ ever reached Applied. Null with no applications reached yet. */
  offerRate: number | null;
  sponsorSplit: ApplicationSponsorSplitEntry[];
  /** Averaged only over applications that actually have a match_score — sampleSize says how many that was, so the average is never presented as covering more than it does. */
  averageMatchScore: { value: number | null; sampleSize: number };
};

/** The three adjacent pairs that make up the core progression funnel. */
const FUNNEL_PAIRS: [ApplicationStatus, ApplicationStatus][] = [
  ["wishlist", "applied"],
  ["applied", "interview"],
  ["interview", "offer"],
];

const SPONSOR_SPLIT_ORDER: (JobSponsorMatchStatus | "not_checked")[] = ["confirmed_sponsor", "unconfirmed", "not_found", "not_checked"];

function percentage(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

export async function getApplicationFunnelAnalytics(userId: string): Promise<ApplicationFunnelAnalytics> {
  const supabase = await createClient();

  const [{ data: applicationRows }, { data: historyRows }] = await Promise.all([
    supabase.from("applications").select("status, sponsor_status, match_score").eq("user_id", userId),
    supabase.from("application_status_history").select("application_id, to_status").eq("user_id", userId),
  ]);

  const applications = (applicationRows ?? []) as {
    status: ApplicationStatus;
    sponsor_status: JobSponsorMatchStatus | null;
    match_score: number | null;
  }[];
  const total = applications.length;

  const currentCounts = new Map<ApplicationStatus, number>();
  for (const application of applications) {
    currentCounts.set(application.status, (currentCounts.get(application.status) ?? 0) + 1);
  }

  // Which distinct applications have *ever* reached each status — the
  // real funnel signal, not just where an application happens to sit
  // today. If a user's own kanban/table usage skips logging an
  // intermediate stage (e.g. straight from Wishlist to Interview), this
  // honestly reflects that gap rather than inferring a stage that was
  // never actually recorded.
  const everReached = new Map<ApplicationStatus, Set<string>>(APPLICATION_STATUSES.map((status) => [status, new Set<string>()]));
  for (const row of historyRows ?? []) {
    everReached.get(row.to_status as ApplicationStatus)?.add(row.application_id);
  }

  const byStage: ApplicationFunnelStage[] = APPLICATION_STATUSES.map((status) => ({
    status,
    currentCount: currentCounts.get(status) ?? 0,
    everReachedCount: everReached.get(status)?.size ?? 0,
  }));

  const stageConversions: ApplicationStageConversion[] = FUNNEL_PAIRS.map(([from, to]) => {
    const fromCount = everReached.get(from)?.size ?? 0;
    const toCount = everReached.get(to)?.size ?? 0;
    return { from, to, fromCount, toCount, rate: fromCount > 0 ? Math.round((toCount / fromCount) * 100) : null };
  });

  const appliedCount = everReached.get("applied")?.size ?? 0;
  const interviewRate = appliedCount > 0 ? Math.round(((everReached.get("interview")?.size ?? 0) / appliedCount) * 100) : null;
  const offerRate = appliedCount > 0 ? Math.round(((everReached.get("offer")?.size ?? 0) / appliedCount) * 100) : null;

  const sponsorCounts = new Map<JobSponsorMatchStatus | "not_checked", number>();
  for (const application of applications) {
    const key = application.sponsor_status ?? "not_checked";
    sponsorCounts.set(key, (sponsorCounts.get(key) ?? 0) + 1);
  }
  const sponsorSplit: ApplicationSponsorSplitEntry[] = SPONSOR_SPLIT_ORDER.map((status) => {
    const count = sponsorCounts.get(status) ?? 0;
    return { status, count, percentage: percentage(count, total) };
  });

  const scores = applications.map((application) => application.match_score).filter((score): score is number => score !== null);
  const averageMatchScore = {
    value: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    sampleSize: scores.length,
  };

  return { totalApplications: total, byStage, stageConversions, interviewRate, offerRate, sponsorSplit, averageMatchScore };
}
