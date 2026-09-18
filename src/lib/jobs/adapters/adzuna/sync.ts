import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAdzunaJobsPage, type AdzunaSearchParams } from "@/lib/jobs/adapters/adzuna/client";
import { normalizeAdzunaJob } from "@/lib/jobs/adapters/adzuna/normalize";
import { startJobImport, completeJobImport, failJobImport, ingestNormalizedJobs } from "@/lib/jobs/ingest";
import type { NormalizedJobInput } from "@/lib/jobs/types";

const ADZUNA_SOURCE_SLUG = "adzuna";

export type AdzunaSyncOptions = Pick<AdzunaSearchParams, "keywords" | "location" | "resultsPerPage"> & {
  /** How many result pages to walk — bounded on purpose: this runs inside one request/invocation (a cron-triggered Route Handler), not a long-lived background job, so an unbounded crawl risks a timeout rather than a clean partial result. */
  maxPages?: number;
};

export type AdzunaSyncResult =
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

/**
 * Ensures the `adzuna` public.job_sources row exists and returns its
 * id — created on first run rather than seeded by migration, since
 * unlike the `manual` row (migration 0059), this one only makes sense
 * once Adzuna is actually configured.
 */
async function ensureAdzunaSourceId(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const { data: existing } = await supabase
    .from("job_sources")
    .select("id")
    .eq("slug", ADZUNA_SOURCE_SLUG)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("job_sources")
    .insert({ slug: ADZUNA_SOURCE_SLUG, name: "Adzuna", base_url: "https://www.adzuna.co.uk" })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Couldn't create the Adzuna job source: ${error?.message}`);
  return created.id;
}

/**
 * Fetches, normalizes, and upserts UK Adzuna listings into
 * public.jobs, logging the whole run as a real migration 0060
 * `job_imports` row (`processing` → `completed`/`failed`) rather than
 * only returning an in-memory result — that row is what
 * `job_source_sync_status` and any future "last synced" UI reads.
 * Runs on the service-role client — public.jobs has no insert/update
 * policy for an authenticated/anon session (migration 0059), by
 * design: this is a trusted system integration writing on behalf of no
 * particular user, the same reasoning src/lib/supabase/admin.ts's own
 * doc comment gives for createAdminClient existing at all.
 *
 * One bad listing from the feed doesn't abort the run —
 * normalizeAdzunaJob reports and skips it, same "per-row report, keep
 * going" approach the graduate schemes CSV importer uses. The actual
 * upsert (dedup + create/update split) is shared with every other
 * source adapter via src/lib/jobs/ingest.ts, so this file only owns
 * fetching and normalizing Adzuna's own shape.
 */
export async function syncAdzunaJobs(options: AdzunaSyncOptions = {}): Promise<AdzunaSyncResult> {
  const maxPages = Math.max(1, Math.min(options.maxPages ?? 1, 10));
  const supabase = createAdminClient();

  let sourceId: string;
  try {
    sourceId = await ensureAdzunaSourceId(supabase);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't set up the Adzuna job source." };
  }

  const importId = await startJobImport(supabase, sourceId);

  const errors: string[] = [];
  const normalizedJobs: NormalizedJobInput[] = [];

  for (let page = 1; page <= maxPages; page++) {
    let pageResult;
    try {
      pageResult = await fetchAdzunaJobsPage({
        keywords: options.keywords,
        location: options.location,
        resultsPerPage: options.resultsPerPage,
        page,
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Adzuna page ${page} request failed.`);
      break;
    }

    if (pageResult.results.length === 0) break;

    for (const raw of pageResult.results) {
      const normalized = normalizeAdzunaJob(raw);
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
    const message = err instanceof Error ? err.message : "Couldn't save Adzuna jobs.";
    await failJobImport(supabase, importId, message);
    return { error: message };
  }
}
