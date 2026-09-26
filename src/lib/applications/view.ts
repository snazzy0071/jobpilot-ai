// The tracker's client-side view logic — search, filter, sort and column grouping — kept as plain functions so the
// board and the table read one already-computed list, and so it is unit-testable without a browser.

import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from "@/lib/applications/types";

export const SPONSOR_FILTER_VALUES = ["all", "confirmed_sponsor", "unconfirmed", "not_found", "none"] as const;
export type SponsorFilterValue = (typeof SPONSOR_FILTER_VALUES)[number];

export const DEADLINE_FILTER_VALUES = ["all", "overdue", "next_7_days", "has_deadline", "no_deadline"] as const;
export type DeadlineFilterValue = (typeof DEADLINE_FILTER_VALUES)[number];

export const APPLICATION_SORTS = ["updated_desc", "created_desc", "applied_desc", "deadline_asc", "company_az", "match_desc", "status"] as const;
export type ApplicationSort = (typeof APPLICATION_SORTS)[number];

export type TrackerView = "kanban" | "table";

export type TrackerFilterState = {
  search: string;
  status: ApplicationStatus | "all";
  sponsor: SponsorFilterValue;
  /** A CV id, "all", or "none" (no CV linked). */
  cvId: string;
  /** A cover letter id, "all", or "none". */
  coverLetterId: string;
  deadline: DeadlineFilterValue;
  sort: ApplicationSort;
};

export const DEFAULT_TRACKER_FILTERS: TrackerFilterState = {
  search: "",
  status: "all",
  sponsor: "all",
  cvId: "all",
  coverLetterId: "all",
  deadline: "all",
  sort: "updated_desc",
};

/** Stages where the application is over: a passed deadline there is history, not something to chase. */
const CLOSED_STATUSES: ApplicationStatus[] = ["rejected", "withdrawn"];

/** Today's date as YYYY-MM-DD in the person's own calendar (deadlines are dates, not instants). */
export function localDateString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export type DeadlineState = "none" | "overdue" | "soon" | "later";

/** Overdue = the date has passed and the application is still open; soon = within the next 7 days. Closed applications (Rejected/Withdrawn) never read as overdue. */
export function deadlineState(application: Pick<Application, "deadline" | "status">, today: string): DeadlineState {
  if (!application.deadline) return "none";
  if (CLOSED_STATUSES.includes(application.status)) return "later";
  if (application.deadline < today) return "overdue";
  return application.deadline <= addDays(today, 7) ? "soon" : "later";
}

function searchable(application: Application): string {
  return [application.companyName, application.jobTitle, application.location, application.salary, application.notes].filter(Boolean).join(" ").toLowerCase();
}

export function applyFilters(applications: Application[], filters: TrackerFilterState, today: string): Application[] {
  const terms = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return applications.filter((application) => {
    // Every word must appear somewhere in company / role / location / salary / notes.
    if (terms.length > 0) {
      const haystack = searchable(application);
      if (!terms.every((term) => haystack.includes(term))) return false;
    }
    if (filters.status !== "all" && application.status !== filters.status) return false;
    if (filters.sponsor !== "all") {
      const matches = filters.sponsor === "none" ? application.sponsorStatus === null : application.sponsorStatus === filters.sponsor;
      if (!matches) return false;
    }
    if (filters.cvId !== "all") {
      if (filters.cvId === "none" ? application.cvId !== null : application.cvId !== filters.cvId) return false;
    }
    if (filters.coverLetterId !== "all") {
      if (filters.coverLetterId === "none" ? application.coverLetterId !== null : application.coverLetterId !== filters.coverLetterId) return false;
    }
    if (filters.deadline !== "all") {
      const state = deadlineState(application, today);
      if (filters.deadline === "overdue" && state !== "overdue") return false;
      if (filters.deadline === "next_7_days" && state !== "soon") return false;
      if (filters.deadline === "has_deadline" && state === "none") return false;
      if (filters.deadline === "no_deadline" && state !== "none") return false;
    }
    return true;
  });
}

/** Nulls always sort last, in either direction. */
function compareNullable<T>(a: T | null, b: T | null, compare: (x: T, y: T) => number): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return compare(a, b);
}

export function applySort(applications: Application[], sort: ApplicationSort): Application[] {
  const sorted = [...applications];
  switch (sort) {
    case "deadline_asc":
      return sorted.sort((a, b) => compareNullable(a.deadline, b.deadline, (x, y) => x.localeCompare(y)));
    case "company_az":
      return sorted.sort((a, b) => a.companyName.localeCompare(b.companyName, "en-GB", { sensitivity: "base" }) || a.jobTitle.localeCompare(b.jobTitle, "en-GB", { sensitivity: "base" }));
    case "match_desc":
      return sorted.sort((a, b) => compareNullable(a.matchScore, b.matchScore, (x, y) => y - x));
    case "applied_desc":
      return sorted.sort((a, b) => compareNullable(a.appliedAt, b.appliedAt, (x, y) => y.localeCompare(x)));
    case "created_desc":
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "status":
      return sorted.sort((a, b) => APPLICATION_STATUSES.indexOf(a.status) - APPLICATION_STATUSES.indexOf(b.status));
    case "updated_desc":
    default:
      return sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export type StatusGroups = Record<ApplicationStatus, Application[]>;

export function groupByStatus(applications: Application[]): StatusGroups {
  const groups = Object.fromEntries(APPLICATION_STATUSES.map((status) => [status, [] as Application[]])) as StatusGroups;
  for (const application of applications) groups[application.status].push(application);
  return groups;
}

export function hasActiveFilters(filters: TrackerFilterState): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.sponsor !== "all" ||
    filters.cvId !== "all" ||
    filters.coverLetterId !== "all" ||
    filters.deadline !== "all"
  );
}
