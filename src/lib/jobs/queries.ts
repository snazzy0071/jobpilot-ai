import "server-only";
import { createClient } from "@/lib/supabase/server";
import { matchJobToSponsor, matchJobsToSponsors, type JobSponsorMatch } from "@/lib/jobs/sponsor-match";
import type { Job, JobMatch, JobSearchFilters, JobSearchResult, JobSource, JobSourceSyncStatus } from "@/lib/jobs/types";

// This is the ONLY place a page/Server Action should read jobs from. Every function here reads the local database
// through the request's own (RLS-respecting) client and never imports anything from src/lib/jobs/adapters/* or
// src/lib/jobs/ingest.ts. That split is what "queryable without calling external APIs on every page load" means in
// this codebase: ingestion (adapters/sync-runner, service role, cron-triggered) and reading (this file, request-time)
// never share a code path, so rendering a page can never trigger an Adzuna/Reed request.

const PAGE_SIZE = 20;

type SearchRow = {
  id: string;
  source_id: string;
  external_id: string | null;
  title: string;
  company_name: string;
  location: string | null;
  description: string;
  url: string;
  posted_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  match_score: number | null;
  total_count: number | string;
};

const JOB_SELECT_FIELDS =
  "id, source_id, external_id, title, company_name, location, description, url, posted_at, expires_at, is_active";

type JobRow = Omit<SearchRow, "match_score" | "total_count">;

function toJob(row: JobRow & { match_score?: number | null }): Job {
  return {
    id: row.id,
    sourceId: row.source_id,
    externalId: row.external_id,
    title: row.title,
    companyName: row.company_name,
    location: row.location,
    description: row.description,
    url: row.url,
    postedAt: row.posted_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    matchScore: row.match_score ?? null,
  };
}

function failedResult(page: number): JobSearchResult {
  return { results: [], total: 0, page, pageSize: PAGE_SIZE, totalPages: 0, failed: true };
}

async function callSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: JobSearchFilters,
  offset: number,
) {
  const hasKeywords = !!filters.keywords?.trim();
  const useCv = !!filters.cvVersionId;
  // relevance needs a query, best-match needs a CV; either without its input falls back to newest-first.
  const requested = filters.sort ?? (hasKeywords ? "relevance" : "newest");
  const sort = requested === "relevance" && !hasKeywords ? "newest" : requested === "match_desc" && !useCv ? "newest" : requested;

  return supabase.rpc("search_jobs", {
    p_query: hasKeywords ? filters.keywords!.trim().slice(0, 200) : null,
    p_location: filters.location?.trim() ? filters.location.trim().slice(0, 100) : null,
    p_source_id: filters.sourceId ?? null,
    p_posted_within_days: filters.postedWithinDays && filters.postedWithinDays > 0 ? filters.postedWithinDays : null,
    p_sponsor_only: filters.sponsorOnly === true,
    p_cv_version_id: useCv ? filters.cvVersionId : null,
    p_min_score: useCv && filters.minMatchScore ? filters.minMatchScore : null,
    p_sort: sort,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });
}

/**
 * Real search over public.jobs, one ranked SQL call (migration 0101's search_jobs): full-text over title, company and
 * description plus substring on title/company, location and date filters, the licensed-sponsor filter evaluated over
 * the WHOLE candidate set against the register, and — for a signed-in user with a CV picked — that user's stored match
 * scores for threshold filtering and best-match ordering, all combinable. It only ever returns what the public jobs
 * policy allows (active, unexpired, non-duplicate). A failed query is reported as `failed`, never as "no jobs": an
 * outage must not read as an empty feed.
 */
export async function searchJobs(filters: JobSearchFilters = {}): Promise<JobSearchResult> {
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(filters.page ?? 1));

  const { data: initialData, error } = await callSearch(supabase, filters, (page - 1) * PAGE_SIZE);
  if (error) {
    console.error("searchJobs failed:", error.message);
    return failedResult(page);
  }

  // A page past the end of the results has no rows to carry the total from — show the last page that has some.
  let rows = (initialData ?? []) as SearchRow[];
  let effectivePage = page;
  if (rows.length === 0 && page > 1) {
    const first = await callSearch(supabase, filters, 0);
    if (first.error) {
      console.error("searchJobs failed:", first.error.message);
      return failedResult(page);
    }
    rows = (first.data ?? []) as SearchRow[];
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    effectivePage = Math.min(page, Math.max(1, Math.ceil(total / PAGE_SIZE)));
    if (effectivePage > 1) {
      const last = await callSearch(supabase, filters, (effectivePage - 1) * PAGE_SIZE);
      if (last.error) return failedResult(page);
      rows = (last.data ?? []) as SearchRow[];
    }
  }

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return {
    results: rows.map(toJob),
    total,
    page: effectivePage,
    pageSize: PAGE_SIZE,
    totalPages: total === 0 ? 0 : Math.ceil(total / PAGE_SIZE),
    failed: false,
  };
}

/** The real, current set of job sources — for the feed's source filter dropdown, never a hardcoded list (same reasoning src/lib/sponsors/queries.ts's getDistinctSponsorRoutes gives for its own filter options). */
export async function listJobSources(): Promise<JobSource[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("job_sources").select("id, slug, name").eq("is_active", true).order("name");
  if (error || !data) return [];
  return data;
}

export async function getJobById(id: string): Promise<Job | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("jobs").select(JOB_SELECT_FIELDS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toJob(data as JobRow);
}

/** Every source's last successful sync — the "data last updated" disclaimer a future jobs page would show, same role sponsor_sync_status plays for the sponsor register. */
export async function getJobSourceSyncStatuses(): Promise<JobSourceSyncStatus[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_source_sync_status")
    .select("source_id, import_id, fetched_count, created_count, updated_count, duplicate_count, completed_at, time_since_last_success");
  if (error || !data) return [];

  return data.map((row) => ({
    sourceId: row.source_id,
    importId: row.import_id,
    fetchedCount: row.fetched_count,
    createdCount: row.created_count,
    updatedCount: row.updated_count,
    duplicateCount: row.duplicate_count,
    completedAt: row.completed_at,
    timeSinceLastSuccess: row.time_since_last_success,
  }));
}

/**
 * A job plus its sponsor-register cross-reference — for a job detail
 * page wanting exactly one job's badge. A feed/list page showing a
 * badge per row should call getSponsorMatchesForJobs below instead
 * (one batched call for the whole page of results), not this in a
 * loop. src/lib/jobs/sponsor-match.ts's own doc comment covers the
 * actual matching rules; the one that matters here is that
 * `match.status` is only ever 'confirmed_sponsor' on a fully
 * unambiguous match — anything else is 'unconfirmed' or 'not_found',
 * never a guessed "yes"/"no".
 */
export async function getJobWithSponsorMatch(id: string): Promise<{ job: Job; sponsorMatch: JobSponsorMatch } | null> {
  const job = await getJobById(id);
  if (!job) return null;

  const sponsorMatch = await matchJobToSponsor(job.companyName);
  return { job, sponsorMatch };
}

/** Batched sponsor-register cross-reference for a whole page of results — the "sponsor badge" every job feed card needs, computed once for the visible page rather than once per card. Keyed by company name (not job id): two jobs at the same employer share one lookup. */
export async function getSponsorMatchesForJobs(jobs: Job[]): Promise<Map<string, JobSponsorMatch>> {
  return matchJobsToSponsors(jobs.map((job) => job.companyName));
}

/**
 * Existing job_matches rows for a whole page of jobs, for one user's CV
 * version — the "show the score if we already have one" lookup a feed
 * card needs, distinct from actually running a new match
 * (src/lib/jobs/matching/actions.ts#runJobMatch, always an explicit
 * user action, never triggered by loading this page). Scoped to the
 * requesting session automatically via job_matches' own RLS.
 */
export async function getJobMatchesForCv(jobIds: string[], cvVersionId: string): Promise<Map<string, JobMatch>> {
  const results = new Map<string, JobMatch>();
  if (jobIds.length === 0) return results;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_matches")
    .select(
      "id, job_id, cv_version_id, match_score, verdict, reasons, gaps, core_skills_score, core_skills_summary, tech_functional_skills_score, tech_functional_skills_summary, domain_fit_score, domain_fit_summary, seniority_score, seniority_summary, created_at",
    )
    .eq("cv_version_id", cvVersionId)
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  if (error || !data) return results;

  // Most recent match per job wins (job_matches is append-only — a job
  // scored more than once keeps every prior row, same as ats_scans).
  for (const row of data) {
    if (results.has(row.job_id)) continue;
    results.set(row.job_id, {
      id: row.id,
      jobId: row.job_id,
      cvVersionId: row.cv_version_id,
      matchScore: row.match_score,
      verdict: row.verdict,
      components: {
        coreSkills: { score: row.core_skills_score, summary: row.core_skills_summary },
        techFunctionalSkills: { score: row.tech_functional_skills_score, summary: row.tech_functional_skills_summary },
        domainFit: { score: row.domain_fit_score, summary: row.domain_fit_summary },
        seniority: { score: row.seniority_score, summary: row.seniority_summary },
      },
      reasons: row.reasons,
      gaps: row.gaps,
      createdAt: row.created_at,
    });
  }
  return results;
}

/** A single source's display name — used when snapshotting a job onto a saved_jobs row (src/lib/jobs/wishlist/actions.ts); a one-off lookup, not worth a batched version since a save action only ever touches one job. */
export async function getJobSourceName(sourceId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("job_sources").select("name").eq("id", sourceId).maybeSingle();
  return data?.name ?? null;
}

/** Which of these job ids the current session has already saved — the feed's own "already on your wishlist" state, one batched query per page rather than one per card. Scoped to the requesting user automatically via saved_jobs' own RLS. */
export async function getSavedJobIds(jobIds: string[]): Promise<Set<string>> {
  if (jobIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("saved_jobs").select("job_id").in("job_id", jobIds);
  return new Set((data ?? []).map((row) => row.job_id).filter((id): id is string => id !== null));
}

/** Which of these jobs the user already has in their tracker, as job id -> application id: the feed's "In tracker" state, one query per page. Scoped to the requesting user by applications' own RLS. */
export async function getTrackedApplicationIds(jobIds: string[]): Promise<Map<string, string>> {
  const tracked = new Map<string, string>();
  if (jobIds.length === 0) return tracked;
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select("id, job_id").in("job_id", jobIds);
  for (const row of data ?? []) if (row.job_id) tracked.set(row.job_id, row.id);
  return tracked;
}

// The daily sync runs at 02:00-02:30 UTC; a source that has not completed one in this long has missed a run.
const FEED_STALE_AFTER_HOURS = 36;

export type JobFeedSourceStatus = {
  sourceId: string;
  name: string;
  lastCompletedAt: string | null;
  /** The most recent sync run's outcome: 'failed' means the newest attempt did not work even if an older one did. */
  latestRunStatus: "pending" | "processing" | "completed" | "failed" | null;
  latestRunError: string | null;
  stale: boolean;
};

export type JobFeedStatus = {
  totalVisible: number;
  /** When the feed last completed any source's sync, or null if nothing has ever synced. */
  lastUpdatedAt: string | null;
  sources: JobFeedSourceStatus[];
};

/**
 * What the feed page needs to be honest about its data: how many listings are live, when each source last synced, and
 * whether the newest attempt failed or has gone stale. Sources that have never run are omitted (an unconfigured
 * provider is not an outage). Reads only the local database.
 */
export async function getJobFeedStatus(): Promise<JobFeedStatus> {
  const supabase = await createClient();
  const [{ data: sources }, { data: statusRows }, { count }] = await Promise.all([
    supabase.from("job_sources").select("id, name").eq("is_active", true).order("name"),
    supabase.from("job_source_sync_status").select("source_id, completed_at"),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
  ]);

  const completedBySource = new Map((statusRows ?? []).map((row) => [row.source_id as string, row.completed_at as string]));
  const now = Date.now();

  const withRuns = await Promise.all(
    (sources ?? []).map(async (source) => {
      const { data: latest } = await supabase
        .from("job_imports")
        .select("status, error_message")
        .eq("run_type", "sync")
        .eq("source_id", source.id)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastCompletedAt = completedBySource.get(source.id) ?? null;
      return {
        sourceId: source.id,
        name: source.name,
        lastCompletedAt,
        latestRunStatus: (latest?.status ?? null) as JobFeedSourceStatus["latestRunStatus"],
        latestRunError: latest?.status === "failed" ? (latest.error_message ?? null) : null,
        stale: lastCompletedAt !== null && now - new Date(lastCompletedAt).getTime() > FEED_STALE_AFTER_HOURS * 3_600_000,
      };
    }),
  );
  const sourcesWithHistory = withRuns.filter((source) => source.latestRunStatus !== null);

  const completedTimes = sourcesWithHistory.map((source) => source.lastCompletedAt).filter((value): value is string => value !== null);
  return {
    totalVisible: count ?? 0,
    lastUpdatedAt: completedTimes.length > 0 ? completedTimes.reduce((a, b) => (a > b ? a : b)) : null,
    sources: sourcesWithHistory,
  };
}
