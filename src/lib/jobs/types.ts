// Canonical source for the jobs domain — mirrors migration 0059's real
// Postgres shape (public.job_sources / public.jobs). See that
// migration's own header comment for why title/company/location each
// carry a `_normalized` twin and how expiry (`expires_at`/`is_active`)
// works.

import type { JobSponsorMatchStatus } from "@/lib/jobs/sponsor-match";

export type JobSource = {
  id: string;
  slug: string;
  name: string;
};

/** One public.jobs row, as a reader (search results, saved jobs, matches) consumes it — normalized columns are an internal dedup/search key, not shown here, same split as SponsorListItem excluding company_name_normalized. */
export type Job = {
  id: string;
  sourceId: string;
  externalId: string | null;
  title: string;
  companyName: string;
  location: string | null;
  description: string;
  url: string;
  postedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  /** The requesting user's stored match score for the CV picked in the feed, when one exists. Only search results carry it. */
  matchScore?: number | null;
};

/**
 * The shape a source adapter (e.g.
 * src/lib/jobs/adapters/adzuna/normalize.ts) produces for one listing,
 * ready to upsert into public.jobs — everything migration 0059 requires
 * a row to have, computed once here rather than left for the DB's own
 * check constraints to catch late. `sourceId` is resolved separately
 * (the adapter looks up/creates its own public.job_sources row), so it
 * isn't part of this shape.
 */
export type NormalizedJobInput = {
  externalId: string | null;
  title: string;
  titleNormalized: string;
  companyName: string;
  companyNameNormalized: string;
  location: string | null;
  locationNormalized: string | null;
  description: string;
  url: string;
  postedAt: string | null;
  expiresAt: string | null;
};

export const JOB_SORTS = ["relevance", "newest", "oldest", "company_az", "match_desc"] as const;
export type JobSort = (typeof JOB_SORTS)[number];

export type JobSearchFilters = {
  /** Words to look for in the title, company and description. */
  keywords?: string;
  /** A town, city or region — substring match on the job's location. */
  location?: string;
  sourceId?: string;
  /** Only jobs posted within this many days — undefined/0 means no date filter. */
  postedWithinDays?: number;
  /** relevance (default when there are keywords) / newest / oldest / company_az / match_desc (needs cvVersionId). */
  sort?: JobSort;
  /**
   * Only jobs whose employer is a confirmed licensed sponsor on the Home Office register (src/lib/jobs/sponsor-match.ts:
   * an unambiguous exact match, on the sponsor's name or a trading-name alias) — evaluated in SQL over every matching
   * job, never 'unconfirmed'/'not_found'.
   */
  sponsorOnly?: boolean;
  /** The current version of the CV to match against, already resolved by the page. Needed for minMatchScore / match_desc. */
  cvVersionId?: string;
  /** Only jobs already scored (job_matches) at or above this for cvVersionId — jobs never scored for that CV have no score to compare, so they don't appear. Never triggers a live AI call. */
  minMatchScore?: number;
  page?: number;
};

export type JobSearchResult = {
  results: Job[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** True when the search itself failed (database error) — distinct from a real search that found nothing. */
  failed: boolean;
};

/** One migration 0060 job_source_sync_status row — "when did this source last sync successfully, and what happened". */
export type JobSourceSyncStatus = {
  sourceId: string;
  importId: string;
  fetchedCount: number | null;
  createdCount: number | null;
  updatedCount: number | null;
  duplicateCount: number | null;
  completedAt: string;
  /** Postgres interval, as PostgREST serializes it (e.g. "2 days 03:14:52"). */
  timeSinceLastSuccess: string;
};

// Matches migration 0059's public.job_match_verdict enum exactly.
export const JOB_MATCH_VERDICTS = ["strong_match", "worth_applying", "stretch", "not_a_fit"] as const;
export type JobMatchVerdict = (typeof JOB_MATCH_VERDICTS)[number];

export const JOB_MATCH_VERDICT_LABELS: Record<JobMatchVerdict, string> = {
  strong_match: "Strong match",
  worth_applying: "Worth applying",
  stretch: "Stretch",
  not_a_fit: "Not a fit",
};

export type JobMatchComponentScore = {
  score: number;
  summary: string;
};

/** The four independently-scored dimensions src/lib/ai/prompts/job-match.ts's jobMatchSchema (v2.0.0) produces and migration 0061 persists as named columns — this is what makes a match "transparent" rather than one opaque number. */
export type JobMatchComponents = {
  coreSkills: JobMatchComponentScore;
  techFunctionalSkills: JobMatchComponentScore;
  domainFit: JobMatchComponentScore;
  seniority: JobMatchComponentScore;
};

/** One public.job_matches row (migrations 0059/0061), as src/lib/jobs/matching/actions.ts persists and returns it. */
export type JobMatch = {
  id: string;
  jobId: string;
  cvVersionId: string | null;
  matchScore: number;
  verdict: JobMatchVerdict;
  components: JobMatchComponents;
  reasons: string[];
  gaps: string[];
  createdAt: string;
};

/**
 * One public.saved_jobs row (migrations 0059/0062) — a real wishlist
 * entry, not just a pointer. `companyName`/`jobTitle`/`url`/
 * `sourceName`/`sponsorStatus`/`matchScore` are all snapshotted at the
 * moment the job was saved (src/lib/jobs/wishlist/actions.ts), so this
 * stays fully meaningful even if the live `jobs` row referenced by
 * `jobId` is later pruned (migration 0062's own header comment covers
 * why) — `jobId` is nullable for exactly that reason, and `url` is the
 * external posting's own link, still valid regardless.
 */
export type SavedJob = {
  id: string;
  jobId: string | null;
  companyName: string;
  jobTitle: string;
  url: string;
  sourceName: string;
  sponsorStatus: JobSponsorMatchStatus;
  /** Null means no CV was selected (or nothing had been scored yet) at save time — distinct from a real low score. */
  matchScore: number | null;
  notes: string | null;
  createdAt: string;
};
