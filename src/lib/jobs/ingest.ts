import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedJobInput } from "@/lib/jobs/types";
import { buildDuplicateLookup, duplicateLookupKey } from "@/lib/jobs/dedupe";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Shared by every source adapter's sync — one place implementing "create the job_imports row, upsert with dedup,
 * close out the row with real counts", so a new source only has to implement fetch + normalize, not reimplement
 * ingestion semantics that must stay identical across sources for job_source_sync_status/dedup to mean the same thing
 * everywhere.
 */

export async function startJobImport(supabase: AdminClient, sourceId: string): Promise<string> {
  const { data, error } = await supabase
    .from("job_imports")
    .insert({ run_type: "sync", source_id: sourceId, status: "processing" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Couldn't start a job import record: ${error?.message}`);
  return data.id;
}

export async function completeJobImport(
  supabase: AdminClient,
  importId: string,
  counts: { fetchedCount: number; createdCount: number; updatedCount: number; duplicateCount: number; skippedCount: number },
  /** Set when the run completed but not cleanly (a search failed, listings were skipped) — surfaced on the admin page. */
  warning?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("job_imports")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      fetched_count: counts.fetchedCount,
      created_count: counts.createdCount,
      updated_count: counts.updatedCount,
      duplicate_count: counts.duplicateCount,
      skipped_count: counts.skippedCount,
      error_message: warning ? warning.slice(0, 2000) : null,
    })
    .eq("id", importId);
  if (error) throw new Error(`Couldn't record the finished import: ${error.message}`);
}

export async function failJobImport(supabase: AdminClient, importId: string, errorMessage: string): Promise<void> {
  await supabase
    .from("job_imports")
    .update({ status: "failed", completed_at: new Date().toISOString(), error_message: errorMessage.slice(0, 2000) })
    .eq("id", importId);
}

export type IngestResult = { createdCount: number; updatedCount: number; duplicateCount: number };

// A batch upsert is one HTTP request carrying every row's description; keep each request comfortably small.
const UPSERT_CHUNK = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function toRow(sourceId: string, job: NormalizedJobInput, nowIso: string) {
  return {
    source_id: sourceId,
    external_id: job.externalId,
    title: job.title,
    title_normalized: job.titleNormalized,
    company_name: job.companyName,
    company_name_normalized: job.companyNameNormalized,
    location: job.location,
    location_normalized: job.locationNormalized,
    description: job.description,
    url: job.url,
    posted_at: job.postedAt,
    expires_at: job.expiresAt,
    is_active: true,
    last_seen_at: nowIso,
  };
}

/**
 * Upserts a normalized batch for one source.
 *
 * - The batch is first collapsed to one row per external id (a feed can repeat a listing across pages, and a batch
 *   upsert containing the same key twice is an error that would fail the whole run).
 * - A listing this source already has is updated in place (and reconfirmed: `last_seen_at`, `is_active`). Its
 *   `duplicate_of_job_id` is never touched — omitted from the payload — so a decision made when it was first seen sticks.
 * - A genuinely new listing gets one dedup decision: if another *visible* listing (any source) has the same
 *   company + title + location it is stored as a duplicate of that one (hidden from search, kept as evidence);
 *   otherwise it is an original. Repeats *within* the batch dedupe the same way: the first is the original, the
 *   rest point at it — written in a second step, once the original has an id.
 */
export async function ingestNormalizedJobs(supabase: AdminClient, sourceId: string, jobs: NormalizedJobInput[]): Promise<IngestResult> {
  const byExternalId = new Map<string, NormalizedJobInput>();
  const withoutExternalId: NormalizedJobInput[] = [];
  for (const job of jobs) {
    if (job.externalId === null) withoutExternalId.push(job);
    else byExternalId.set(job.externalId, job);
  }
  const unique = [...byExternalId.values(), ...withoutExternalId];
  if (unique.length === 0) return { createdCount: 0, updatedCount: 0, duplicateCount: 0 };

  const existingExternalIds = new Set<string>();
  for (const ids of chunk([...byExternalId.keys()], 200)) {
    const { data, error } = await supabase.from("jobs").select("external_id").eq("source_id", sourceId).in("external_id", ids);
    if (error) throw new Error(`Couldn't check existing jobs: ${error.message}`);
    for (const row of data ?? []) if (row.external_id) existingExternalIds.add(row.external_id);
  }

  const newJobs = unique.filter((job) => job.externalId === null || !existingExternalIds.has(job.externalId));
  const updatedJobs = unique.filter((job) => job.externalId !== null && existingExternalIds.has(job.externalId));

  const duplicateLookup = await buildDuplicateLookup(supabase, newJobs);
  const nowIso = new Date().toISOString();

  const originals: NormalizedJobInput[] = [];
  const dbDuplicates: { job: NormalizedJobInput; originalId: string }[] = [];
  const batchDuplicates: { job: NormalizedJobInput; originalKey: string }[] = [];
  const firstInBatch = new Set<string>();
  for (const job of newJobs) {
    const key = duplicateLookupKey(job);
    const originalId = duplicateLookup.get(key);
    if (originalId) dbDuplicates.push({ job, originalId });
    else if (firstInBatch.has(key)) batchDuplicates.push({ job, originalKey: key });
    else {
      firstInBatch.add(key);
      originals.push(job);
    }
  }

  for (const rows of chunk(updatedJobs, UPSERT_CHUNK)) {
    const { error } = await supabase.from("jobs").upsert(
      rows.map((job) => toRow(sourceId, job, nowIso)),
      { onConflict: "source_id,external_id" },
    );
    if (error) throw new Error(`Couldn't update existing jobs: ${error.message}`);
  }

  const firstWave = [
    ...originals.map((job) => ({ ...toRow(sourceId, job, nowIso), duplicate_of_job_id: null as string | null })),
    ...dbDuplicates.map(({ job, originalId }) => ({ ...toRow(sourceId, job, nowIso), duplicate_of_job_id: originalId as string | null })),
  ];
  for (const rows of chunk(firstWave, UPSERT_CHUNK)) {
    const { error } = await supabase.from("jobs").upsert(rows, { onConflict: "source_id,external_id" });
    if (error) throw new Error(`Couldn't save new jobs: ${error.message}`);
  }

  if (batchDuplicates.length > 0) {
    // Resolve each batch-internal duplicate to the id its original was just given.
    const originalIdByKey = new Map<string, string>();
    const originalExternalIds = originals.map((job) => job.externalId).filter((id): id is string => id !== null);
    for (const ids of chunk(originalExternalIds, 200)) {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, company_name_normalized, title_normalized, location_normalized")
        .eq("source_id", sourceId)
        .in("external_id", ids);
      if (error) throw new Error(`Couldn't link duplicate jobs: ${error.message}`);
      for (const row of data ?? []) {
        originalIdByKey.set(
          duplicateLookupKey({
            companyNameNormalized: row.company_name_normalized,
            titleNormalized: row.title_normalized,
            locationNormalized: row.location_normalized,
          }),
          row.id,
        );
      }
    }
    const rows = batchDuplicates.map(({ job, originalKey }) => ({
      ...toRow(sourceId, job, nowIso),
      duplicate_of_job_id: originalIdByKey.get(originalKey) ?? null,
    }));
    for (const part of chunk(rows, UPSERT_CHUNK)) {
      const { error } = await supabase.from("jobs").upsert(part, { onConflict: "source_id,external_id" });
      if (error) throw new Error(`Couldn't save duplicate jobs: ${error.message}`);
    }
  }

  return {
    createdCount: newJobs.length,
    updatedCount: updatedJobs.length,
    duplicateCount: dbDuplicates.length + batchDuplicates.length,
  };
}
