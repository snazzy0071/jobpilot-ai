import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminJobFeedHealth } from "@/lib/admin/jobs/types";

const RECENT_RUNS_LIMIT = 30;

function firstOf<T>(value: T[] | T | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

/**
 * Every read here goes through the regular client — `job_sources` and
 * `job_imports` both carry "Anyone can view" (migration 0059/0060),
 * and `jobs`' own "Anyone can view active, unexpired jobs" policy is
 * *exactly* the slice this page wants for "how many live listings does
 * this source have" — no service-role client needed anywhere in this
 * module. No "run sync now" button here either, same reasoning
 * src/lib/admin/sponsors/queries.ts's own comment gives.
 */
export async function getJobFeedHealth(): Promise<AdminJobFeedHealth> {
  const supabase = await createClient();

  const [{ data: sources }, { data: statusRows }, { count: totalActiveJobs }, { data: runs }] = await Promise.all([
    supabase.from("job_sources").select("id, name, is_active").order("name"),
    supabase.from("job_source_sync_status").select("source_id, completed_at, fetched_count, created_count, updated_count"),
    supabase.from("jobs").select("id", { count: "exact", head: true }),
    supabase
      .from("job_imports")
      .select(
        "id, run_type, status, fetched_count, created_count, updated_count, duplicate_count, deactivated_count, pruned_count, error_message, started_at, completed_at, job_sources(name)",
      )
      .order("started_at", { ascending: false })
      .limit(RECENT_RUNS_LIMIT),
  ]);

  const statusBySource = new Map((statusRows ?? []).map((row) => [row.source_id, row]));

  // Per-source counts, not one "fetch every active job row" query — the
  // number of sources is small and fixed (Adzuna, Reed, …), while the
  // number of active listings isn't; N cheap counts beats fetching
  // every row just to tally them in JS.
  const sourceHealth = await Promise.all(
    (sources ?? []).map(async (source) => {
      const { count: activeJobCount } = await supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("source_id", source.id);
      const status = statusBySource.get(source.id);
      return {
        sourceId: source.id,
        sourceName: source.name,
        isActive: source.is_active,
        activeJobCount: activeJobCount ?? 0,
        lastCompletedAt: status?.completed_at ?? null,
        fetchedCount: status?.fetched_count ?? null,
        createdCount: status?.created_count ?? null,
        updatedCount: status?.updated_count ?? null,
      };
    }),
  );

  const recentRuns = (runs ?? []).map((run) => {
    const source = firstOf(run.job_sources as { name: string }[] | { name: string } | null);
    return {
      id: run.id,
      runType: run.run_type,
      sourceName: source?.name ?? null,
      status: run.status,
      fetchedCount: run.fetched_count,
      createdCount: run.created_count,
      updatedCount: run.updated_count,
      duplicateCount: run.duplicate_count,
      deactivatedCount: run.deactivated_count,
      prunedCount: run.pruned_count,
      errorMessage: run.error_message,
      startedAt: run.started_at,
      completedAt: run.completed_at,
    };
  });

  return { totalActiveJobs: totalActiveJobs ?? 0, sources: sourceHealth, recentRuns };
}
