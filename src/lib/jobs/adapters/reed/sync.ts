import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchReedJobsPage, type ReedSearchParams } from "@/lib/jobs/adapters/reed/client";
import { normalizeReedJob } from "@/lib/jobs/adapters/reed/normalize";
import { startJobImport, completeJobImport, failJobImport, ingestNormalizedJobs } from "@/lib/jobs/ingest";
import { sleep } from "@/lib/jobs/adapters/http-retry";
import type { NormalizedJobInput } from "@/lib/jobs/types";

const REED_SOURCE_SLUG = "reed";
/** A courtesy gap between sequential page requests, on top of fetchReedJobsPage's own 429 retry/backoff — a conservative, unverified default (no live Reed account in this environment to tune it against), not a number sourced from Reed's documented limit. */
const BETWEEN_PAGE_DELAY_MS = 300;

export type ReedSyncOptions = Pick<ReedSearchParams, "keywords" | "location" | "resultsPerPage"> & {
  /** Bounded for the same reason as the Adzuna adapter's maxPages: this runs inside one request/invocation, not a long-lived background job. */
  maxPages?: number;
};

export type ReedSyncResult =
  | { error: string }
  | {
      importId: string;
      fetchedCount: number;
      createdCount: number;
      updatedCount: number;
      duplicateCount: number;
      skippedCount: number;
      errors: string[];
    };

/** Same shape as the Adzuna adapter's ensureAdzunaSourceId — created on first run, not seeded by migration, since this row only makes sense once Reed is actually configured. */
async function ensureReedSourceId(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data: existing } = await supabase.from("job_sources").select("id").eq("slug", REED_SOURCE_SLUG).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("job_sources")
    .insert({ slug: REED_SOURCE_SLUG, name: "Reed", base_url: "https://www.reed.co.uk" })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Couldn't create the Reed job source: ${error?.message}`);
  return created.id;
}

/**
 * Fetches, normalizes, and upserts UK Reed listings into public.jobs —
 * same shape and reasoning as src/lib/jobs/adapters/adzuna/sync.ts,
 * including logging the run as a real migration 0060 `job_imports` row
 * and sharing the actual dedup/upsert step via src/lib/jobs/ingest.ts.
 *
 * Error/rate-limit handling: fetchReedJobsPage already retries a 429
 * with backoff (src/lib/jobs/adapters/http-retry.ts) and throws a
 * distinct, clear error for an exhausted rate limit vs. a rejected API
 * key vs. any other failure. If a page request still throws after that,
 * the run stops and reports it (the job_imports row is marked
 * 'failed') rather than crashing — whatever was already fetched and
 * normalized from earlier pages is still ingested first, so a mid-run
 * failure loses nothing already retrieved. A small delay between
 * sequential page requests is a courtesy on top of that, not a
 * replacement for it.
 */
export async function syncReedJobs(options: ReedSyncOptions = {}): Promise<ReedSyncResult> {
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 1, 10));
  const supabase = createAdminClient();

  let sourceId: string;
  try {
    sourceId = await ensureReedSourceId(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't set up the Reed job source." };
  }

  const importId = await startJobImport(supabase, sourceId);

  const errors: string[] = [];
  const normalizedJobs: NormalizedJobInput[] = [];

  for (let page = 1; page <= maxPages; page++) {
    if (page > 1) await sleep(BETWEEN_PAGE_DELAY_MS);

    let pageResult;
    try {
      pageResult = await fetchReedJobsPage({
        keywords: options.keywords,
        location: options.location,
        resultsPerPage: options.resultsPerPage,
        page,
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Reed page ${page} request failed.`);
      break;
    }

    if (pageResult.results.length === 0) break;

    for (const raw of pageResult.results) {
      const normalized = normalizeReedJob(raw);
      if ("error" in normalized) {
        errors.push(normalized.error);
        continue;
      }
      normalizedJobs.push(normalized.job);
    }
  }

  try {
    const { createdCount, updatedCount, duplicateCount } = await ingestNormalizedJobs(supabase, sourceId, normalizedJobs);
    await completeJobImport(supabase, importId, {
      fetchedCount: normalizedJobs.length + errors.length,
      createdCount,
      updatedCount,
      duplicateCount,
    });
    return {
      importId,
      fetchedCount: normalizedJobs.length + errors.length,
      createdCount,
      updatedCount,
      duplicateCount,
      skippedCount: errors.length,
      errors,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't save Reed jobs.";
    await failJobImport(supabase, importId, message);
    return { error: message };
  }
}
