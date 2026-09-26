import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedJobInput } from "@/lib/jobs/types";

/**
 * A job is treated as "the same real-world listing" as another when company/title/location all match after
 * normalization — not a hard DB uniqueness constraint (two different real openings can legitimately share all three),
 * so this key is only an application-level lookup, never a unique index.
 */
export function duplicateLookupKey(job: {
  companyNameNormalized: string;
  titleNormalized: string;
  locationNormalized: string | null;
}): string {
  return `${job.companyNameNormalized}||${job.titleNormalized}||${job.locationNormalized ?? ""}`;
}

// The batch is sent as three arrays in one RPC body (not as URL filters), so this only bounds the request size.
const LOOKUP_CHUNK = 250;

/**
 * For a batch of incoming jobs, which already have a still-visible original (any source)? One set-based query per
 * chunk (migration 0102's find_visible_job_duplicates) — no URL-length limit, no 1,000-row cap. Returns
 * duplicateLookupKey -> the original's id. A lookup that fails is an error, not "no duplicates": treating a database
 * failure as "nothing is a duplicate" would silently publish every duplicate in the batch.
 */
export async function buildDuplicateLookup(
  supabase: ReturnType<typeof createAdminClient>,
  jobs: NormalizedJobInput[],
): Promise<Map<string, string>> {
  const lookup = new Map<string, string>();

  for (let start = 0; start < jobs.length; start += LOOKUP_CHUNK) {
    const part = jobs.slice(start, start + LOOKUP_CHUNK);
    const { data, error } = await supabase.rpc("find_visible_job_duplicates", {
      p_company: part.map((job) => job.companyNameNormalized),
      p_title: part.map((job) => job.titleNormalized),
      // A job with no location carries a null element; the function compares with "is not distinct from".
      p_location: part.map((job) => job.locationNormalized),
    });
    if (error) throw new Error(`Couldn't check for duplicate jobs: ${error.message}`);
    for (const row of data ?? []) {
      lookup.set(duplicateLookupKey(part[row.pos - 1]), row.original_id);
    }
  }
  return lookup;
}
