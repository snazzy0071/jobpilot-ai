import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobFeedError } from "@/lib/jobs/feed-error";
import { startJobImport, completeJobImport, failJobImport, ingestNormalizedJobs } from "@/lib/jobs/ingest";
import { sleep } from "@/lib/jobs/adapters/http-retry";
import { JOB_SYNC_MAX_PAGES_PER_SEARCH, JOB_SYNC_SEARCHES, JOB_SYNC_TIME_BUDGET_MS, type JobSyncSearch } from "@/config/job-sync";
import type { NormalizedJobInput } from "@/lib/jobs/types";

/** What differs between job feeds — everything else about a sync run is the same and lives in runJobSync. */
export type JobFeedAdapter = {
  slug: string;
  name: string;
  baseUrl: string;
  /** A courtesy gap between sequential requests, on top of the client's own 429 retry/backoff. */
  betweenRequestsMs: number;
  fetchPage(search: JobSyncSearch, page: number): Promise<{ results: unknown[] }>;
  normalize(raw: unknown): { job: NormalizedJobInput } | { error: string };
};

export type JobSyncOptions = {
  /** Overrides the configured searches (a manual run for one keyword/location). */
  searches?: JobSyncSearch[];
  /** Pages per search — bounded on purpose: this runs inside one serverless invocation. */
  maxPages?: number;
  /** Injectable for tests. */
  timeBudgetMs?: number;
};

export type JobSyncResult =
  | { error: string }
  | {
      importId: string;
      fetchedCount: number;
      createdCount: number;
      updatedCount: number;
      duplicateCount: number;
      skippedCount: number;
      /** Feed failures and skipped-listing notes; non-empty on a run that completed but not cleanly. */
      warnings: string[];
    };

const MAX_WARNINGS = 12;

async function ensureSourceId(supabase: ReturnType<typeof createAdminClient>, adapter: JobFeedAdapter): Promise<string> {
  const { data: existing } = await supabase.from("job_sources").select("id").eq("slug", adapter.slug).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("job_sources")
    .insert({ slug: adapter.slug, name: adapter.name, base_url: adapter.baseUrl })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Couldn't create the ${adapter.name} job source: ${error?.message}`);
  return created.id;
}

function describeSearch(search: JobSyncSearch): string {
  return [search.keywords && `"${search.keywords}"`, search.location && `in ${search.location}`].filter(Boolean).join(" ") || "the default search";
}

/**
 * One sync run for one feed: walk each configured search page by page, normalize, dedupe and upsert into public.jobs,
 * and record the whole run as a job_imports row.
 *
 * How feed failures are handled (this is the part the daily job depends on):
 *   - A failed request ends *that search* and is remembered; the other searches still run, and everything fetched
 *     before the failure is still ingested — a mid-run failure loses nothing already retrieved.
 *   - A failure that would repeat for every request (rejected credentials, exhausted rate limit, not configured) stops
 *     the whole run instead of hammering the provider.
 *   - If not one request succeeded, the run is recorded as FAILED with the reason and nothing is ingested. A run where
 *     some requests worked is COMPLETED but carries a warning (shown on the admin page), so a green run can't hide a
 *     broken search. Listings that fail normalization are counted as skipped, one by one.
 *   - Nothing is ever marked stale or removed because a sync failed: jobs are only retired by expiry / last_seen_at in
 *     the maintenance sweep, so a provider outage can't empty the feed.
 * Rate limits: the client retries 429s with backoff; runs are also time-boxed so they finish inside the route's limit.
 */
export async function runJobSync(adapter: JobFeedAdapter, options: JobSyncOptions = {}): Promise<JobSyncResult> {
  const searches = options.searches?.length ? options.searches : JOB_SYNC_SEARCHES;
  const maxPages = Math.max(1, Math.min(options.maxPages ?? JOB_SYNC_MAX_PAGES_PER_SEARCH, 10));
  const deadline = Date.now() + (options.timeBudgetMs ?? JOB_SYNC_TIME_BUDGET_MS);
  const supabase = createAdminClient();

  let sourceId: string;
  try {
    sourceId = await ensureSourceId(supabase, adapter);
  } catch (err) {
    return { error: err instanceof Error ? err.message : `Couldn't set up the ${adapter.name} job source.` };
  }

  let importId: string;
  try {
    importId = await startJobImport(supabase, sourceId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't start a job import record." };
  }

  const warnings: string[] = [];
  const skippedNotes: string[] = [];
  const jobs: NormalizedJobInput[] = [];
  let fetchedCount = 0;
  let skippedCount = 0;
  let requestsSucceeded = 0;
  let requestsFailed = 0;
  let stopAll = false;
  let outOfTime = false;

  searchLoop: for (const search of searches) {
    for (let page = 1; page <= maxPages; page++) {
      if (Date.now() >= deadline) {
        outOfTime = true;
        break searchLoop;
      }
      if (requestsSucceeded + requestsFailed > 0) await sleep(adapter.betweenRequestsMs);

      let results: unknown[];
      try {
        ({ results } = await adapter.fetchPage(search, page));
      } catch (err) {
        requestsFailed++;
        const message = err instanceof Error ? err.message : `${adapter.name} request failed.`;
        warnings.push(`${adapter.name} ${describeSearch(search)}, page ${page}: ${message}`);
        if (err instanceof JobFeedError && err.isFatal) stopAll = true;
        if (stopAll) break searchLoop;
        break; // next search
      }
      requestsSucceeded++;

      if (results.length === 0) break;
      fetchedCount += results.length;
      for (const raw of results) {
        const normalized = adapter.normalize(raw);
        if ("error" in normalized) {
          skippedCount++;
          if (skippedNotes.length < 3) skippedNotes.push(normalized.error);
          continue;
        }
        jobs.push(normalized.job);
      }
    }
  }

  if (outOfTime) warnings.push(`Stopped early: the run's ${Math.round((options.timeBudgetMs ?? JOB_SYNC_TIME_BUDGET_MS) / 1000)}s time budget was used up.`);

  if (requestsSucceeded === 0) {
    const message = warnings.length > 0 ? warnings.slice(0, 3).join(" | ") : `${adapter.name} sync made no successful request.`;
    await failJobImport(supabase, importId, message);
    return { error: message };
  }

  if (skippedCount > 0) warnings.push(`${skippedCount} listing${skippedCount === 1 ? "" : "s"} skipped as malformed (e.g. ${skippedNotes.join("; ")}).`);

  try {
    const { createdCount, updatedCount, duplicateCount } = await ingestNormalizedJobs(supabase, sourceId, jobs);
    const capped = warnings.slice(0, MAX_WARNINGS);
    await completeJobImport(supabase, importId, { fetchedCount, createdCount, updatedCount, duplicateCount, skippedCount }, capped.length > 0 ? capped.join(" | ") : null);
    return { importId, fetchedCount, createdCount, updatedCount, duplicateCount, skippedCount, warnings: capped };
  } catch (err) {
    const message = err instanceof Error ? err.message : `Couldn't save ${adapter.name} jobs.`;
    await failJobImport(supabase, importId, message);
    return { error: message };
  }
}
