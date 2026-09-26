import { applicationStatus, hasNoPublishedDeadline, isClosingSoon, todayInUk } from "@/lib/graduate-schemes/status";
import {
  ASSESSMENT_TYPES,
  GRADUATE_SCHEME_SECTORS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUSES,
  STUDY_STAGES,
  type AssessmentType,
  type GraduateScheme,
  type GraduateSchemeSector,
  type GraduateSchemeSponsorshipStatus,
  type StudyStage,
} from "@/lib/graduate-schemes/types";

// The public listing is driven entirely by the URL (`?q=&sector=&...`), so a filtered view can be shared, bookmarked and
// works without JavaScript. This file is the pure part: parse the query string, filter, sort, paginate.

export const SCHEME_SORTS = ["deadline", "opens", "newest", "employer", "salary"] as const;
export type SchemeSort = (typeof SCHEME_SORTS)[number];
export const SCHEME_SORT_LABELS: Record<SchemeSort, string> = {
  deadline: "Deadline (soonest first)",
  opens: "Opening date (soonest first)",
  newest: "Recently verified",
  employer: "Employer (A–Z)",
  salary: "Salary (highest first)",
};

export const STATUS_FILTERS = ["open", "closing_soon", "upcoming", "rolling", "no_deadline", "closed"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  open: "Open now",
  closing_soon: "Closing soon",
  upcoming: "Opening soon",
  rolling: "Rolling applications",
  no_deadline: "No published deadline",
  closed: "Closed",
};

export const PAGE_SIZE = 12;

export type SchemeFilters = {
  q: string;
  sector: GraduateSchemeSector | null;
  stage: StudyStage | null;
  sponsorship: GraduateSchemeSponsorshipStatus | null;
  status: StatusFilter | null;
  location: string;
  assessment: AssessmentType | null;
  sort: SchemeSort;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function member<T extends string>(list: readonly T[], value: string): T | null {
  return (list as readonly string[]).includes(value) ? (value as T) : null;
}

/** Reads the query string defensively: anything unrecognised is ignored rather than trusted or thrown on. */
export function parseSchemeFilters(params: RawParams): SchemeFilters {
  const page = Number.parseInt(one(params.page), 10);
  return {
    q: one(params.q).slice(0, 100),
    sector: member(GRADUATE_SCHEME_SECTORS, one(params.sector)),
    stage: member(STUDY_STAGES, one(params.stage)),
    sponsorship: member(GRADUATE_SCHEME_SPONSORSHIP_STATUSES, one(params.sponsorship)),
    status: member(STATUS_FILTERS, one(params.status)),
    location: one(params.location).slice(0, 100),
    assessment: member(ASSESSMENT_TYPES, one(params.assessment)),
    sort: member(SCHEME_SORTS, one(params.sort)) ?? "deadline",
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : 1,
  };
}

/** The non-default filters as a query string (for pagination links and "clear"), in a stable order. */
export function schemeFiltersToQuery(filters: SchemeFilters, overrides: Partial<SchemeFilters> = {}): string {
  const f = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.sector) params.set("sector", f.sector);
  if (f.stage) params.set("stage", f.stage);
  if (f.sponsorship) params.set("sponsorship", f.sponsorship);
  if (f.status) params.set("status", f.status);
  if (f.location) params.set("location", f.location);
  if (f.assessment) params.set("assessment", f.assessment);
  if (f.sort !== "deadline") params.set("sort", f.sort);
  if (f.page > 1) params.set("page", String(f.page));
  return params.toString();
}

export function hasActiveFilters(filters: SchemeFilters): boolean {
  return !!(filters.q || filters.sector || filters.stage || filters.sponsorship || filters.status || filters.location || filters.assessment);
}

function matchesText(scheme: GraduateScheme, term: string): boolean {
  if (!term) return true;
  const haystack = [scheme.employer, scheme.schemeName, scheme.description ?? "", ...scheme.locations].join(" ").toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function matchesStatus(scheme: GraduateScheme, filter: StatusFilter, today: string): boolean {
  const status = applicationStatus(scheme, today);
  if (filter === "closing_soon") return isClosingSoon(scheme, today);
  if (filter === "no_deadline") return hasNoPublishedDeadline(scheme, today);
  if (filter === "rolling") return scheme.isRolling && status !== "closed";
  if (filter === "open") return status === "open";
  return status === filter;
}

export function filterSchemes(schemes: GraduateScheme[], filters: SchemeFilters, today: string = todayInUk()): GraduateScheme[] {
  const location = filters.location.toLowerCase();
  return schemes.filter(
    (scheme) =>
      matchesText(scheme, filters.q) &&
      (!filters.sector || scheme.sector === filters.sector) &&
      (!filters.stage || scheme.studyStages.includes(filters.stage)) &&
      (!filters.sponsorship || scheme.sponsorshipStatus === filters.sponsorship) &&
      (!filters.status || matchesStatus(scheme, filters.status, today)) &&
      (!location || scheme.locations.some((l) => l.toLowerCase().includes(location))) &&
      (!filters.assessment || scheme.assessments.some((assessment) => assessment.type === filters.assessment)),
  );
}

/** 0 open with a deadline, 1 open without one, 2 opening soon, 3 unknown dates, 4 closed. */
function deadlineRank(scheme: GraduateScheme, today: string): number {
  const status = applicationStatus(scheme, today);
  if (status === "open") return scheme.deadlineOn ? 0 : 1;
  if (status === "upcoming") return 2;
  if (status === "dates_not_published") return 3;
  return 4;
}

export function sortSchemes(schemes: GraduateScheme[], sort: SchemeSort, today: string = todayInUk()): GraduateScheme[] {
  const byName = (a: GraduateScheme, b: GraduateScheme) => a.employer.localeCompare(b.employer) || a.schemeName.localeCompare(b.schemeName);
  const copy = [...schemes];
  switch (sort) {
    case "employer":
      return copy.sort(byName);
    case "opens":
      // Schemes with a published opening date first, earliest first; the rest by name.
      return copy.sort((a, b) => (a.opensOn ?? "9999").localeCompare(b.opensOn ?? "9999") || byName(a, b));
    case "newest":
      return copy.sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt) || byName(a, b));
    case "salary": {
      const top = (s: GraduateScheme) => s.salaryMax ?? s.salaryMin ?? -1;
      return copy.sort((a, b) => top(b) - top(a) || byName(a, b));
    }
    default:
      return copy.sort((a, b) => {
        const ra = deadlineRank(a, today);
        const rb = deadlineRank(b, today);
        if (ra !== rb) return ra - rb;
        if (ra === 0) return a.deadlineOn!.localeCompare(b.deadlineOn!) || byName(a, b);
        if (ra === 2) return a.opensOn!.localeCompare(b.opensOn!) || byName(a, b);
        if (ra === 4) return b.deadlineOn!.localeCompare(a.deadlineOn!) || byName(a, b); // most recently closed first
        return byName(a, b);
      });
  }
}

export function paginate<T>(items: T[], page: number, size: number = PAGE_SIZE): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, totalPages);
  return { items: items.slice((current - 1) * size, current * size), page: current, totalPages };
}
