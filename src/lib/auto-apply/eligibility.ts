import type { AutoApplySettings, JobFacts } from "@/lib/auto-apply/types";

// The rules deciding whether a job may be QUEUED for the user's review. Pure, so every rule is unit-tested and the same function
// runs wherever candidates are built. Being eligible only means "worth putting in front of the user" — approval is always theirs.

export type EligibilityReason = "inactive" | "no_score" | "below_threshold" | "role_mismatch" | "location_mismatch" | "salary_below_minimum" | "salary_unknown" | "not_confirmed_sponsor";

export const REASON_LABELS: Record<EligibilityReason, string> = {
  inactive: "The listing is no longer active",
  no_score: "No match score for your chosen CV yet — score it in the job feed first",
  below_threshold: "Match score is below your threshold",
  role_mismatch: "The title doesn't match any of your roles",
  location_mismatch: "The location doesn't match any of your locations",
  salary_below_minimum: "The published salary is below your minimum",
  salary_unknown: "No salary published, and you asked to exclude those",
  not_confirmed_sponsor: "The employer isn't a confirmed licensed sponsor",
};

const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

/** Any keyword appears in the text (case-insensitive, whole-phrase substring). An empty list matches everything. */
export function matchesAny(text: string | null, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  if (!text) return false;
  const haystack = norm(text);
  return keywords.some((keyword) => keyword.trim() !== "" && haystack.includes(norm(keyword)));
}

export function evaluateJob(settings: AutoApplySettings, job: JobFacts): { eligible: boolean; reasons: EligibilityReason[] } {
  const reasons: EligibilityReason[] = [];
  if (!job.active) reasons.push("inactive");
  if (job.matchScore === null) reasons.push("no_score");
  else if (job.matchScore < settings.minMatchScore) reasons.push("below_threshold");
  if (!matchesAny(job.title, settings.roleKeywords)) reasons.push("role_mismatch");
  if (!matchesAny(job.location, settings.locations)) reasons.push("location_mismatch");
  if (settings.minSalary !== null) {
    if (job.salaryMin === null) {
      if (!settings.includeUnknownSalary) reasons.push("salary_unknown");
    } else if (job.salaryMin < settings.minSalary) reasons.push("salary_below_minimum");
  }
  if (settings.sponsorOnly && !job.sponsorConfirmed) reasons.push("not_confirmed_sponsor");
  return { eligible: reasons.length === 0, reasons };
}

/** The identity of an application, so the same job seen through two feeds (or twice) is one: employer + title, normalised. */
export function dedupeKey(company: string, title: string): string {
  const clean = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\b(limited|ltd|plc|llp|inc|uk|the)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${clean(company)}|${clean(title)}`.slice(0, 200);
}

/** The UK calendar day containing `now`, as [start, end) instants — what "daily limit" counts within. */
export function ukDayWindow(now: Date = new Date()): { start: Date; end: Date } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).split("-").map(Number);
  const midnightUtc = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  // The UK offset at that day's midnight, from the difference between UTC midnight and how London reads that instant.
  const at = (ms: number) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms));
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute")) - ms;
  };
  const start = midnightUtc - at(midnightUtc);
  const nextMidnightUtc = midnightUtc + 86_400_000;
  const end = nextMidnightUtc - at(nextMidnightUtc);
  return { start: new Date(start), end: new Date(end) };
}

/** How many more applications may be approved today. Never negative. */
export function remainingToday(dailyLimit: number, approvedToday: number): number {
  return Math.max(0, dailyLimit - approvedToday);
}
