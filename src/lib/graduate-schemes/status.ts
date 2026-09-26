import type { ApplicationStatus, GraduateScheme } from "@/lib/graduate-schemes/types";

type Timeline = Pick<GraduateScheme, "opensOn" | "deadlineOn" | "isRolling">;

/** Today's calendar date in the UK as YYYY-MM-DD — deadlines are UK dates, so "closed" must not flip at midnight UTC or in the server's zone. */
export function todayInUk(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. Calendar arithmetic on UTC midnights, so daylight saving never skews it. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.UTC(...ymd(to)) - Date.UTC(...ymd(from))) / 86_400_000);
}

function ymd(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m - 1, d];
}

/**
 * Where a scheme is in its cycle, from the dates the employer published:
 * - closed: the deadline has passed (a deadline day itself is still open);
 * - upcoming: it has an opening date in the future;
 * - open: it has opened (or is rolling) and hasn't closed;
 * - dates_not_published: no opening date, no deadline and not rolling — we don't know, so we don't say.
 */
export function applicationStatus(scheme: Timeline, today: string = todayInUk()): ApplicationStatus {
  if (scheme.deadlineOn && scheme.deadlineOn < today) return "closed";
  if (scheme.opensOn && scheme.opensOn > today) return "upcoming";
  if (scheme.opensOn || scheme.deadlineOn || scheme.isRolling) return "open";
  return "dates_not_published";
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  open: "Open",
  upcoming: "Opening soon",
  closed: "Closed",
  dates_not_published: "Dates not published",
};

/** A short, honest line for the timeline: "Closes in 12 days", "Rolling — applications reviewed as they arrive", "Closed 3 days ago". */
export function timelineSummary(scheme: Timeline, today: string = todayInUk()): string {
  const status = applicationStatus(scheme, today);
  if (status === "closed") {
    const days = daysBetween(scheme.deadlineOn!, today);
    return days === 0 ? "Closed today" : `Closed ${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (status === "upcoming") {
    const days = daysBetween(today, scheme.opensOn!);
    return `Opens in ${days} day${days === 1 ? "" : "s"}`;
  }
  if (status === "open") {
    if (scheme.deadlineOn) {
      const days = daysBetween(today, scheme.deadlineOn);
      const closes = days === 0 ? "Closes today" : `Closes in ${days} day${days === 1 ? "" : "s"}`;
      return scheme.isRolling ? `${closes} (rolling — may fill sooner)` : closes;
    }
    return scheme.isRolling ? "Rolling — applications reviewed as they arrive" : "Open";
  }
  return "The employer hasn't published dates";
}

/** A deadline within this many days (today included) counts as "closing soon". */
export const CLOSING_SOON_DAYS = 14;

export function isClosingSoon(scheme: Timeline, today: string = todayInUk()): boolean {
  if (!scheme.deadlineOn || applicationStatus(scheme, today) !== "open") return false;
  return daysBetween(today, scheme.deadlineOn) <= CLOSING_SOON_DAYS;
}

/** True when the employer has published no closing date and the scheme isn't closed (rolling, or simply no dates). */
export function hasNoPublishedDeadline(scheme: Timeline, today: string = todayInUk()): boolean {
  return !scheme.deadlineOn && applicationStatus(scheme, today) !== "closed";
}

export type DeadlineGroup = "closing_soon" | "open" | "rolling" | "upcoming" | "no_deadline" | "closed";

export const DEADLINE_GROUP_LABELS: Record<DeadlineGroup, string> = {
  closing_soon: "Closing soon",
  open: "Open — with a deadline",
  rolling: "Rolling applications",
  upcoming: "Opening soon",
  no_deadline: "No published deadline",
  closed: "Closed",
};

export const DEADLINE_GROUP_ORDER: DeadlineGroup[] = ["closing_soon", "open", "rolling", "upcoming", "no_deadline", "closed"];

/** Exactly one group per scheme, so a scheme never appears twice on the deadlines page. */
export function deadlineGroup(scheme: Timeline, today: string = todayInUk()): DeadlineGroup {
  const status = applicationStatus(scheme, today);
  if (status === "closed") return "closed";
  if (status === "upcoming") return "upcoming";
  if (isClosingSoon(scheme, today)) return "closing_soon";
  if (scheme.deadlineOn) return "open";
  return scheme.isRolling ? "rolling" : "no_deadline";
}
