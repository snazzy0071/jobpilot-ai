import "server-only";
import { createClient } from "@/lib/supabase/server";
import { escapeLikePattern } from "@/lib/jobs/normalize";
import { matchJobToSponsor, matchJobsToSponsors, type JobSponsorMatch } from "@/lib/jobs/sponsor-match";
import type { Job, JobMatch, JobSearchFilters, JobSearchResult, JobSource, JobSourceSyncStatus } from "@/lib/jobs/types";

// This is the ONLY place a page/Server Action should read jobs from —
// every function here queries public.jobs (or job_source_sync_status,
// a view over public.job_imports; or, for match-threshold filtering,
// public.job_matches) directly, through the anon-respecting client, and
// never imports anything from src/lib/jobs/adapters/* or
// src/lib/jobs/ingest.ts. That split is what "queryable without calling
// external APIs on every page load" actually means in this codebase:
// ingestion (adapters/ingest.ts, service-role, cron-triggered) and
// reading (this file, RLS-scoped, request-time) never share a code
// path, so a page render can never accidentally trigger an
// Adzuna/Reed request no matter what it does. Cross-referencing the
// sponsor register (src/lib/jobs/sponsor-match.ts, used for
// `sponsorOnly` and getJobWithSponsorMatch/getSponsorMatchesForJobs
// below) stays inside that same rule too — it reads another table in
// this same local Postgres database, not an external API.
//
// Same "never the admin client" rule src/lib/sponsors/queries.ts and
// src/lib/graduate-schemes/queries.ts document for the same reason:
// this is a public, unauthenticated feature, so it must see exactly
// what an anonymous visitor's own RLS-governed request would see —
// active, unexpired, non-duplicate jobs (migration 0060's select
// policy), never a half-synced or since-deactivated row. Match-
// threshold filtering is the one exception that's inherently
// authenticated: job_matches' own RLS (`auth.uid() = user_id`) already
// scopes that query to whichever user's session cookie this request
// carries, so there's no separate user id to pass in here — an
// unauthenticated request simply sees zero job_matches rows, same as
// it would querying that table directly.

const PAGE_SIZE = 20;
// A keywords search fetches a bounded candidate set and paginates in
// memory, same approach and same reasoning as
// src/lib/sponsors/queries.ts's CANDIDATE_LIMIT: two separate .ilike()
// calls (title, company) merged and deduped in application code, rather
// than one hand-built .or() filter string — a user-typed search term is
// exactly the input an untested PostgREST filter DSL shouldn't be
// trusted with (commas/parens in the term could break out of the
// intended filter structure; escapeLikePattern only guards ILIKE's own
// wildcards, not that).
const CANDIDATE_LIMIT = 300;
// sponsorOnly can't be a SQL filter at all — sponsor matching is a live
// in-app cross-reference (src/lib/jobs/sponsor-match.ts), not a stored
// column. So a sponsorOnly request fetches up to this many *candidate*
// rows (matching every other filter, in the requested sort order) and
// filters them in application code instead of paginating the full
// result set — the same "bounded candidate window, be honest about the
// cap" shape as CANDIDATE_LIMIT above, just for a different reason.
const SPONSOR_CANDIDATE_LIMIT = 200;

const JOB_SELECT_FIELDS =
  "id, source_id, external_id, title, company_name, location, description, url, posted_at, expires_at, is_active";
const JOB_WITH_MATCH_SELECT_FIELDS =
  "id, source_id, external_id, title, company_name, location, description, url, posted_at, expires_at, is_active, job_matches!inner(match_score)";

type JobRow = {
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
};

type JobRowWithMatch = JobRow & { job_matches: { match_score: number }[] };

function toJob(row: JobRow): Job {
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
  };
}

function emptyResult(page: number, truncated = false): JobSearchResult {
  return { results: [], total: 0, page, pageSize: PAGE_SIZE, totalPages: 0, truncated };
}

/** Filters and sponsor-cross-references a candidate list down to confirmed sponsors only, then paginates the filtered list in memory — shared by every branch below once it has a candidate array to work with. */
async function filterToSponsorsAndPaginate(
  candidates: JobRow[],
  page: number,
  candidateLimitHit: boolean,
): Promise<JobSearchResult> {
  if (candidates.length === 0) return emptyResult(page, candidateLimitHit);

  const matches = await matchJobsToSponsors(candidates.map((row) => row.company_name));
  const confirmed = candidates.filter((row) => matches.get(row.company_name)?.status === "confirmed_sponsor");

  const total = confirmed.length;
  const from = (page - 1) * PAGE_SIZE;
  return {
    results: confirmed.slice(from, from + PAGE_SIZE).map(toJob),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    truncated: candidateLimitHit,
  };
}

function sortRows<T extends { posted_at: string | null; company_name: string }>(rows: T[], sort: JobSearchFilters["sort"]): T[] {
  const sorted = [...rows];
  if (sort === "company_az") return sorted.sort((a, b) => a.company_name.localeCompare(b.company_name));
  if (sort === "oldest") {
    return sorted.sort((a, b) => {
      if (!a.posted_at) return 1;
      if (!b.posted_at) return -1;
      return a.posted_at.localeCompare(b.posted_at);
    });
  }
  // "newest" (default) and "match_desc" without an active threshold
  // filter both fall back to newest-first — match_desc only really
  // applies within searchByMatchThreshold, which orders by score
  // itself before this ever runs.
  return sorted.sort((a, b) => {
    if (!a.posted_at) return 1;
    if (!b.posted_at) return -1;
    return b.posted_at.localeCompare(a.posted_at);
  });
}

/** Browsing (no keywords, no match threshold) — real DB-level filters, and (when sponsorOnly is off) exact count + range pagination; no candidate cap needed since there's no OR ambiguity to work around. */
async function browseWithoutKeywords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: JobSearchFilters,
  page: number,
): Promise<JobSearchResult> {
  if (filters.sponsorOnly) {
    let query = supabase.from("jobs").select(JOB_SELECT_FIELDS).limit(SPONSOR_CANDIDATE_LIMIT);
    if (filters.location) query = query.ilike("location", `%${escapeLikePattern(filters.location.trim())}%`);
    if (filters.sourceId) query = query.eq("source_id", filters.sourceId);
    if (filters.postedWithinDays) {
      query = query.gte("posted_at", new Date(Date.now() - filters.postedWithinDays * 86_400_000).toISOString());
    }
    const orderColumn = filters.sort === "company_az" ? "company_name" : "posted_at";
    const { data, error } = await query.order(orderColumn, { ascending: filters.sort === "oldest" || filters.sort === "company_az" });
    if (error) {
      console.error("searchJobs (sponsorOnly browse) failed:", error.message);
      return emptyResult(page);
    }
    const rows = (data as JobRow[]) ?? [];
    return filterToSponsorsAndPaginate(rows, page, rows.length >= SPONSOR_CANDIDATE_LIMIT);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase.from("jobs").select(JOB_SELECT_FIELDS, { count: "exact" });
  if (filters.location) query = query.ilike("location", `%${escapeLikePattern(filters.location.trim())}%`);
  if (filters.sourceId) query = query.eq("source_id", filters.sourceId);
  if (filters.postedWithinDays) {
    query = query.gte("posted_at", new Date(Date.now() - filters.postedWithinDays * 86_400_000).toISOString());
  }

  const orderColumn = filters.sort === "company_az" ? "company_name" : "posted_at";
  const { data, error, count } = await query
    .order(orderColumn, { ascending: filters.sort === "oldest" || filters.sort === "company_az", nullsFirst: false })
    .range(from, to);
  if (error) {
    console.error("searchJobs failed:", error.message);
    return emptyResult(page);
  }

  const total = count ?? 0;
  return {
    results: (data as JobRow[] | null)?.map(toJob) ?? [],
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    truncated: false,
  };
}

/** Keywords given — see this file's own CANDIDATE_LIMIT comment for why this fetches two bounded candidate sets and merges in memory instead of one .or() filter string. sponsorOnly, when set, filters this same merged candidate list before pagination — no extra query shape needed here. */
async function searchByKeywords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: JobSearchFilters,
  page: number,
): Promise<JobSearchResult> {
  const pattern = `%${escapeLikePattern(filters.keywords!.trim())}%`;

  let titleQuery = supabase.from("jobs").select(JOB_SELECT_FIELDS).ilike("title", pattern).limit(CANDIDATE_LIMIT);
  let companyQuery = supabase.from("jobs").select(JOB_SELECT_FIELDS).ilike("company_name", pattern).limit(CANDIDATE_LIMIT);
  if (filters.location) {
    const locationPattern = `%${escapeLikePattern(filters.location.trim())}%`;
    titleQuery = titleQuery.ilike("location", locationPattern);
    companyQuery = companyQuery.ilike("location", locationPattern);
  }
  if (filters.sourceId) {
    titleQuery = titleQuery.eq("source_id", filters.sourceId);
    companyQuery = companyQuery.eq("source_id", filters.sourceId);
  }
  if (filters.postedWithinDays) {
    const cutoff = new Date(Date.now() - filters.postedWithinDays * 86_400_000).toISOString();
    titleQuery = titleQuery.gte("posted_at", cutoff);
    companyQuery = companyQuery.gte("posted_at", cutoff);
  }

  const [titleResult, companyResult] = await Promise.all([titleQuery, companyQuery]);
  if (titleResult.error || companyResult.error) {
    console.error("searchJobs failed:", titleResult.error?.message ?? companyResult.error?.message);
    return emptyResult(page);
  }

  const merged = new Map<string, JobRow>();
  for (const row of [...(titleResult.data as JobRow[]), ...(companyResult.data as JobRow[])]) {
    merged.set(row.id, row);
  }
  const candidateLimitHit = titleResult.data.length >= CANDIDATE_LIMIT || companyResult.data.length >= CANDIDATE_LIMIT;
  const sorted = sortRows([...merged.values()], filters.sort);

  if (filters.sponsorOnly) {
    return filterToSponsorsAndPaginate(sorted, page, candidateLimitHit);
  }

  const total = sorted.length;
  const from = (page - 1) * PAGE_SIZE;
  return {
    results: sorted.slice(from, from + PAGE_SIZE).map(toJob),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    truncated: candidateLimitHit,
  };
}

/**
 * Match-threshold filtering — only jobs already scored (job_matches)
 * for `filters.cvVersionId` at or above `filters.minMatchScore`. A real
 * inner join (`job_matches!inner(match_score)`), same established
 * pattern src/lib/sponsors/queries.ts's route filter uses
 * (`sponsor_routes!inner(route)`) — a literal, non-computed select
 * string, not a runtime ternary (supabase-js parses `.select()` as a
 * template-literal type; a computed string breaks that inference, the
 * exact bug that pattern was already fixed for once this session).
 * job_matches' own RLS (`auth.uid() = user_id`) scopes this to the
 * requesting session automatically — no explicit user id needed here.
 * Never runs an AI call: a job never scored for this CV simply isn't
 * in the join's result set.
 */
async function searchByMatchThreshold(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: JobSearchFilters,
  page: number,
): Promise<JobSearchResult> {
  if (filters.sponsorOnly) {
    let query = supabase
      .from("jobs")
      .select(JOB_WITH_MATCH_SELECT_FIELDS)
      .eq("job_matches.cv_version_id", filters.cvVersionId!)
      .gte("job_matches.match_score", filters.minMatchScore!)
      .limit(SPONSOR_CANDIDATE_LIMIT);
    if (filters.location) query = query.ilike("location", `%${escapeLikePattern(filters.location.trim())}%`);
    if (filters.sourceId) query = query.eq("source_id", filters.sourceId);
    if (filters.postedWithinDays) {
      query = query.gte("posted_at", new Date(Date.now() - filters.postedWithinDays * 86_400_000).toISOString());
    }
    const { data, error } = await query.order("match_score", { referencedTable: "job_matches", ascending: false });
    if (error) {
      console.error("searchJobs (match threshold, sponsorOnly) failed:", error.message);
      return emptyResult(page);
    }
    const rows = (data as JobRowWithMatch[]) ?? [];
    return filterToSponsorsAndPaginate(rows, page, rows.length >= SPONSOR_CANDIDATE_LIMIT);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("jobs")
    .select(JOB_WITH_MATCH_SELECT_FIELDS, { count: "exact" })
    .eq("job_matches.cv_version_id", filters.cvVersionId!)
    .gte("job_matches.match_score", filters.minMatchScore!);
  if (filters.location) query = query.ilike("location", `%${escapeLikePattern(filters.location.trim())}%`);
  if (filters.sourceId) query = query.eq("source_id", filters.sourceId);
  if (filters.postedWithinDays) {
    query = query.gte("posted_at", new Date(Date.now() - filters.postedWithinDays * 86_400_000).toISOString());
  }

  const { data, error, count } = await query
    .order("match_score", { referencedTable: "job_matches", ascending: false })
    .range(from, to);
  if (error) {
    console.error("searchJobs (match threshold) failed:", error.message);
    return emptyResult(page);
  }

  const total = count ?? 0;
  return {
    results: ((data as JobRowWithMatch[] | null) ?? []).map(toJob),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    truncated: false,
  };
}

/**
 * Real search over public.jobs — RLS already limits this to
 * active/unexpired/non-duplicate rows (migration 0060), so there's no
 * extra visibility filtering to apply here on top of what the policy
 * itself guarantees. Dispatches to whichever of the three strategies
 * above the filters call for; `cvVersionId` + `minMatchScore` together
 * take priority over `keywords` — combining a text search with a match-
 * threshold filter in one query isn't supported yet (a documented
 * simplification, not an oversight: the two would need a genuinely
 * different join/merge shape with no live database in this environment
 * to validate it against).
 */
export async function searchJobs(filters: JobSearchFilters = {}): Promise<JobSearchResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);

  if (filters.cvVersionId && filters.minMatchScore) {
    return searchByMatchThreshold(supabase, filters, page);
  }
  if (filters.keywords?.trim()) {
    return searchByKeywords(supabase, filters, page);
  }
  return browseWithoutKeywords(supabase, filters, page);
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
