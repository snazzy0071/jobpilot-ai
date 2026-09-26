import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * How long an active job can go without being reconfirmed by any sync
 * (`jobs.last_seen_at`) before it's treated as likely gone — the
 * fallback for a source (Adzuna) that gives no `expires_at` at all, and
 * a backstop for one (Reed) that does but might not always. Not sourced
 * from either provider's own guidance (no live account to check
 * against); picked as a conservative middle ground — long enough that a
 * job merely outside a bounded sync's page/keyword window for a few
 * runs isn't wrongly flagged, short enough that a genuinely stale
 * listing doesn't linger for months.
 */
export const STALE_AFTER_DAYS = 21;

/**
 * How long a job stays in the table, still readable via job_imports/
 * direct id lookup, after being deactivated before it's hard-deleted.
 * Deliberately much shorter than this app's "never delete historical
 * import evidence blindly" rule for the sponsor register: a sponsor
 * licence entry is evidence of a real regulatory fact with long-term
 * relevance; an expired job listing isn't — nobody needs to know a
 * specific vacancy existed six months ago the way immigration history
 * needs sponsor licence continuity. Pruning only ever removes rows that
 * are already `is_active = false`, never a currently-visible listing.
 */
export const PRUNE_AFTER_DAYS = 30;

/**
 * Deactivates any active job whose stated expiry has passed, or that
 * hasn't been reconfirmed present by any sync in STALE_AFTER_DAYS —
 * see this file's own top comment for why "missing from today's synced
 * batch" alone is never used as a removal signal.
 *
 * Two sequential updates rather than one `.or(...)` filter string —
 * both conditions only ever flip `is_active` from true to false, so
 * running them back to back is exactly as correct as a single combined
 * update, without building a hand-written PostgREST filter string (this
 * codebase's standing caution about `.or()`, e.g.
 * src/lib/sponsors/queries.ts's own reasoning, even though both operands
 * here are computer-generated ISO timestamps, not user input). A job
 * already deactivated by the first update no longer matches the second
 * update's `is_active = true` filter, so nothing is double-counted.
 */
export async function deactivateExpiredJobs(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const nowIso = new Date().toISOString();
  const staleCutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error: expiredError } = await supabase
    .from("jobs")
    .update({ is_active: false })
    .eq("is_active", true)
    .lt("expires_at", nowIso)
    .select("id");
  if (expiredError) throw new Error(`Couldn't deactivate expired jobs: ${expiredError.message}`);

  const { data: stale, error: staleError } = await supabase
    .from("jobs")
    .update({ is_active: false })
    .eq("is_active", true)
    .lt("last_seen_at", staleCutoff)
    .select("id");
  if (staleError) throw new Error(`Couldn't deactivate stale jobs: ${staleError.message}`);

  return (expired?.length ?? 0) + (stale?.length ?? 0);
}

/**
 * Hard-deletes jobs that have been inactive for PRUNE_AFTER_DAYS —
 * `updated_at` is what a deactivation itself bumps (the `set_jobs_
 * updated_at` trigger, migration 0059), so this measures "how long
 * has it been inactive", not "how long has it existed".
 */
export async function pruneOldInactiveJobs(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const pruneCutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("jobs")
    .delete()
    .eq("is_active", false)
    .lt("updated_at", pruneCutoff)
    .select("id");
  if (error) throw new Error(`Couldn't prune old inactive jobs: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * A duplicate is hidden only while the listing it duplicates is live (migration 0060). Once that original has expired
 * or been deactivated, promote the earliest-seen duplicate to the visible listing (and re-point the rest at it) —
 * otherwise a role still being advertised elsewhere would vanish from the feed the day its first posting closed. Must
 * run after deactivateExpiredJobs so it sees the originals that just went inactive.
 */
export async function promoteOrphanedDuplicates(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data, error } = await supabase.rpc("promote_orphaned_job_duplicates");
  if (error) throw new Error(`Couldn't promote orphaned duplicate jobs: ${error.message}`);
  return typeof data === "number" ? data : 0;
}

export type JobsMaintenanceResult = { error: string } | { deactivatedCount: number; promotedCount: number; prunedCount: number };

/**
 * The cross-source maintenance sweep (GET /api/cron/jobs-maintenance) —
 * logged as its own job_imports row (run_type: 'maintenance', no
 * source_id, since both steps operate over every source at once).
 */
export async function runJobsMaintenance(): Promise<JobsMaintenanceResult> {
  const supabase = createAdminClient();

  const { data: importRow, error: importError } = await supabase
    .from("job_imports")
    .insert({ run_type: "maintenance", status: "processing" })
    .select("id")
    .single();
  if (importError || !importRow) return { error: `Couldn't start a maintenance run record: ${importError?.message}` };

  try {
    const deactivatedCount = await deactivateExpiredJobs(supabase);
    const promotedCount = await promoteOrphanedDuplicates(supabase);
    const prunedCount = await pruneOldInactiveJobs(supabase);

    await supabase
      .from("job_imports")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        deactivated_count: deactivatedCount,
        pruned_count: prunedCount,
      })
      .eq("id", importRow.id);

    return { deactivatedCount, promotedCount, prunedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Jobs maintenance failed.";
    await supabase
      .from("job_imports")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_message: message.slice(0, 2000) })
      .eq("id", importRow.id);
    return { error: message };
  }
}
