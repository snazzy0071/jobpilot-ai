import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedJobInput } from "@/lib/jobs/types";
import { buildDuplicateLookup, duplicateLookupKey } from "@/lib/jobs/dedupe";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Shared by every source adapter's sync.ts (Adzuna, Reed, and any
 * future one) — one place implementing "create the job_imports row,
 * upsert with dedup, close out the row with real counts", so a new
 * source only has to implement fetch + normalize, not reimplement
 * ingestion semantics that must stay identical across sources for
 * job_source_sync_status/dedup to mean the same thing everywhere.
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
  counts: { fetchedCount: number; createdCount: number; updatedCount: number; duplicateCount: number },
): Promise<void> {
  await supabase
    .from("job_imports")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      fetched_count: counts.fetchedCount,
      created_count: counts.createdCount,
      updated_count: counts.updatedCount,
      duplicate_count: counts.duplicateCount,
    })
    .eq("id", importId);
}

export async function failJobImport(supabase: AdminClient, importId: string, errorMessage: string): Promise<void> {
  await supabase
    .from("job_imports")
    .update({ status: "failed", completed_at: new Date().toISOString(), error_message: errorMessage.slice(0, 2000) })
    .eq("id", importId);
}

export type IngestResult = { createdCount: number; updatedCount: number; duplicateCount: number };

/**
 * Upserts a normalized batch for one source. Split into two upsert
 * calls on purpose: an already-existing (source_id, external_id) row
 * never has its `duplicate_of_job_id` touched here (omitted from that
 * call's payload entirely, so `on conflict do update` leaves it as
 * whatever it already was) — only a genuinely new row gets a fresh
 * dedup decision, via a single batched lookup
 * (src/lib/jobs/dedupe.ts's buildDuplicateLookup), not a fabricated
 * default in the DB.
 */
export async function ingestNormalizedJobs(
  supabase: AdminClient,
  sourceId: string,
  jobs: NormalizedJobInput[],
): Promise<IngestResult> {
  if (jobs.length === 0) return { createdCount: 0, updatedCount: 0, duplicateCount: 0 };

  const externalIds = jobs.map((job) => job.externalId).filter((id): id is string => id !== null);
  const { data: existingRows, error: existingError } = await supabase
    .from("jobs")
    .select("external_id")
    .eq("source_id", sourceId)
    .in("external_id", externalIds);
  if (existingError) throw new Error(`Couldn't check existing jobs: ${existingError.message}`);

  const existingExternalIds = new Set((existingRows ?? []).map((row) => row.external_id));
  const newJobs = jobs.filter((job) => !existingExternalIds.has(job.externalId));
  const updatedJobs = jobs.filter((job) => existingExternalIds.has(job.externalId));

  const duplicateLookup = await buildDuplicateLookup(supabase, newJobs);
  let duplicateCount = 0;

  const nowIso = new Date().toISOString();

  if (newJobs.length > 0) {
    const rows = newJobs.map((job) => {
      const duplicateOfJobId = duplicateLookup.get(duplicateLookupKey(job)) ?? null;
      if (duplicateOfJobId) duplicateCount++;
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
        duplicate_of_job_id: duplicateOfJobId,
      };
    });
    const { error } = await supabase.from("jobs").upsert(rows, { onConflict: "source_id,external_id" });
    if (error) throw new Error(`Couldn't save new jobs: ${error.message}`);
  }

  if (updatedJobs.length > 0) {
    const rows = updatedJobs.map((job) => ({
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
    }));
    const { error } = await supabase.from("jobs").upsert(rows, { onConflict: "source_id,external_id" });
    if (error) throw new Error(`Couldn't update existing jobs: ${error.message}`);
  }

  return { createdCount: newJobs.length, updatedCount: updatedJobs.length, duplicateCount };
}
