import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements/service";
import { getApplicationFunnelAnalytics, type ApplicationFunnelAnalytics } from "@/lib/applications/analytics";
import { listApplications } from "@/lib/applications/queries";
import { hasTestPrepAccess } from "@/lib/test-prep/access";
import { getTestPrepInsights, EMPTY_TEST_PREP_INSIGHTS, type TestPrepInsights } from "@/lib/test-prep/analytics";
import { getGraduateSchemes } from "@/lib/graduate-schemes/queries";
import { todayInUk } from "@/lib/graduate-schemes/status";
import { buildDeadlines, type DeadlineItem } from "@/lib/dashboard/deadlines";
import type { Application } from "@/lib/applications/types";

// Everything the dashboard overview shows that isn't already fetched by
// its own page (CVs, cover letters, interviews, LinkedIn drafts, tool
// access states) — every number is a real read of this user's own rows,
// with the explicit `.eq("user_id", ...)` these queries all carry as
// defence in depth on top of RLS. Deliberately no fabricated fallback
// anywhere: a missing table row or failed read becomes an empty/`null`
// value the UI renders as an honest empty state, never a placeholder
// figure.

export type UserPreferencesSnapshot = {
  targetRoles: string[];
  careerStage: string | null;
  location: string | null;
  graduationYear: number | null;
  visaSponsorshipPreference: string | null;
};

export type SavedJobPreview = {
  id: string;
  companyName: string;
  jobTitle: string;
  sponsorStatus: string;
  matchScore: number | null;
  createdAt: string;
};

export type JobMatchPreview = { jobId: string; title: string; company: string; score: number; scoredAt: string };

export type RecentScan = { id: string; score: number; at: string };
export type RecentTestSession = { id: string; score: number; at: string };

export const STRONG_MATCH_SCORE = 75;

export type DashboardOverviewData = {
  planSlug: string;
  preferences: UserPreferencesSnapshot;
  savedJobs: { total: number; sponsored: number; latest: SavedJobPreview[] };
  funnel: ApplicationFunnelAnalytics;
  applications: Application[];
  testPrep: TestPrepInsights;
  /** Jobs this user has already had scored against a CV (still active listings only), best first. */
  jobMatches: { scored: number; strong: number; top: JobMatchPreview[] };
  deadlines: DeadlineItem[];
  recentScans: RecentScan[];
  recentTestSessions: RecentTestSession[];
};

export async function getDashboardOverview(userId: string): Promise<DashboardOverviewData> {
  const supabase = await createClient();

  const [entitlements, prefsResult, savedResult, funnel, applications, testPrep, matchesResult, strongResult, schemes, scansResult, sessionsResult, sponsoredResult] = await Promise.all([
    getEntitlements(userId),
    supabase
      .from("user_preferences")
      .select("target_roles, career_stage, location, graduation_year, visa_sponsorship_preference")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("saved_jobs")
      .select("id, company_name, job_title, sponsor_status, match_score, created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    getApplicationFunnelAnalytics(userId),
    listApplications(userId).catch((err) => {
      console.error("Dashboard overview: applications unavailable:", err);
      return [] as Application[];
    }),
    // Only for a plan that includes Test Prep (its history is otherwise empty by construction); a read failure shows as no history here rather than breaking the dashboard.
    hasTestPrepAccess(userId)
      .then((allowed) => (allowed ? getTestPrepInsights(userId) : EMPTY_TEST_PREP_INSIGHTS))
      .catch((err) => {
        console.error("Dashboard overview: test prep insights unavailable:", err);
        return EMPTY_TEST_PREP_INSIGHTS;
      }),
    supabase
      .from("job_matches")
      .select("job_id, match_score, created_at, jobs!inner(title, company_name, is_active)", { count: "exact" })
      .eq("user_id", userId)
      .eq("jobs.is_active", true)
      .order("match_score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("job_matches")
      .select("id, jobs!inner(is_active)", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("jobs.is_active", true)
      .gte("match_score", STRONG_MATCH_SCORE),
    // Published schemes are public data; a failure here only means no scheme deadlines are listed.
    getGraduateSchemes().catch(() => []),
    supabase.from("ats_scans").select("id, match_score, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("test_sessions").select("id, score, completed_at").eq("user_id", userId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(5),
    supabase.from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("sponsor_status", "confirmed_sponsor"),
  ]);

  const prefs = prefsResult.data as {
    target_roles: string[] | null;
    career_stage: string | null;
    location: string | null;
    graduation_year: number | null;
    visa_sponsorship_preference: string | null;
  } | null;

  const savedRows = (savedResult.data ?? []) as {
    id: string;
    company_name: string;
    job_title: string;
    sponsor_status: string;
    match_score: number | null;
    created_at: string;
  }[];

  return {
    planSlug: entitlements.planSlug,
    preferences: {
      targetRoles: prefs?.target_roles ?? [],
      careerStage: prefs?.career_stage ?? null,
      location: prefs?.location ?? null,
      graduationYear: prefs?.graduation_year ?? null,
      visaSponsorshipPreference: prefs?.visa_sponsorship_preference ?? null,
    },
    savedJobs: {
      total: savedResult.count ?? savedRows.length,
      sponsored: sponsoredResult.count ?? 0,
      latest: savedRows.slice(0, 3).map((row) => ({
        id: row.id,
        companyName: row.company_name,
        jobTitle: row.job_title,
        sponsorStatus: row.sponsor_status,
        matchScore: row.match_score,
        createdAt: row.created_at,
      })),
    },
    funnel,
    applications,
    testPrep,
    jobMatches: {
      scored: matchesResult.count ?? 0,
      strong: strongResult.count ?? 0,
      top: ((matchesResult.data ?? []) as unknown as { job_id: string; match_score: number; created_at: string; jobs: { title: string; company_name: string } | { title: string; company_name: string }[] }[]).map((row) => {
        const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
        return { jobId: row.job_id, title: job?.title ?? "Job", company: job?.company_name ?? "", score: row.match_score, scoredAt: row.created_at };
      }),
    },
    deadlines: buildDeadlines({ applications, schemes, today: todayInUk() }),
    recentScans: (scansResult.data ?? []).map((row) => ({ id: row.id, score: row.match_score, at: row.created_at })),
    recentTestSessions: (sessionsResult.data ?? []).filter((row) => row.score !== null).map((row) => ({ id: row.id, score: row.score as number, at: row.completed_at as string })),
  };
}
