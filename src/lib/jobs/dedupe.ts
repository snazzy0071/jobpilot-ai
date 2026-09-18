import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedJobInput } from "@/lib/jobs/types";

/**
 * A job is treated as "the same real-world listing" as another when
 * title/company/location all match after normalization — not a hard DB
 * uniqueness constraint (migration 0060's own comment on
 * `duplicate_of_job_id` explains why: two different real openings can
 * legitimately share all three), so this key is only ever used for an
 * application-level lookup, never a unique index.
 */
export function duplicateLookupKey(job: {
  companyNameNormalized: string;
  titleNormalized: string;
  locationNormalized: string | null;
}): string {
  return `${job.companyNameNormalized}||${job.titleNormalized}||${job.locationNormalized ?? ""}`;
}

/**
 * One bounded query for a whole batch instead of one lookup per job —
 * fetches every currently-visible, not-already-a-duplicate job whose
 * company name matches any job in this batch (a broad prefilter, since
 * `.in()` on a single column is safe and well-tested, unlike building an
 * `.or()` filter string by hand — same reasoning
 * src/lib/sponsors/queries.ts gives for avoiding that), then narrows to
 * an exact title+location match in application code. Safe at the batch
 * sizes a single sync run produces (bounded by maxPages *
 * resultsPerPage in each adapter's sync.ts, at most a few hundred rows).
 */
export async function buildDuplicateLookup(
  supabase: ReturnType<typeof createAdminClient>,
  jobs: NormalizedJobInput[],
): Promise<Map<string, string>> {
  const companyNames = [...new Set(jobs.map((job) => job.companyNameNormalized))];
  if (companyNames.length === 0) return new Map();

  const { data, error } = await supabase
    .from("jobs")
    .select("id, company_name_normalized, title_normalized, location_normalized")
    .eq("is_active", true)
    .is("duplicate_of_job_id", null)
    .in("company_name_normalized", companyNames);
  if (error || !data) return new Map();

  const lookup = new Map<string, string>();
  for (const row of data) {
    const key = duplicateLookupKey({
      companyNameNormalized: row.company_name_normalized,
      titleNormalized: row.title_normalized,
      locationNormalized: row.location_normalized,
    });
    // First match wins — if more than one existing row somehow shares a
    // key, this links to whichever the query happens to return first
    // rather than picking one "more correctly"; a real ambiguity like
    // that is a data-quality question for a human, not something worth
    // guessing about here.
    if (!lookup.has(key)) lookup.set(key, row.id);
  }
  return lookup;
}
