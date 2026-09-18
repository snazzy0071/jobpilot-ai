import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminSponsorSyncOverview } from "@/lib/admin/sponsors/types";

const IMPORT_HISTORY_LIMIT = 20;

/**
 * `sponsor_imports` carries "Anyone can view" (migration 0049), so the
 * regular client is enough for the import history. `sponsors` itself
 * only grants "Anyone can view *active* sponsors from a completed
 * import" — an honest total (including ones a later sync deactivated)
 * needs the service-role client to see the rest.
 *
 * This pipeline's own schema comment says no gov.uk ingestion job is
 * actually wired up yet — an empty `imports` list and `lastCompletedAt:
 * null` are the accurate, expected state today, not a bug. There's
 * deliberately no "run sync now" button here: that would need a new
 * privileged endpoint, not just a view.
 */
export async function getSponsorSyncOverview(): Promise<AdminSponsorSyncOverview> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: imports }, { data: statusRow }, { count: activeSponsorCount }, { count: totalSponsorCount }] = await Promise.all([
    supabase
      .from("sponsor_imports")
      .select(
        "id, source_date, status, sponsor_count, route_count, added_count, reactivated_count, deactivated_count, error_message, started_at, completed_at",
      )
      .order("started_at", { ascending: false })
      .limit(IMPORT_HISTORY_LIMIT),
    supabase.from("sponsor_sync_status").select("completed_at").maybeSingle(),
    admin.from("sponsors").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("sponsors").select("id", { count: "exact", head: true }),
  ]);

  return {
    activeSponsorCount: activeSponsorCount ?? 0,
    totalSponsorCount: totalSponsorCount ?? 0,
    lastCompletedAt: statusRow?.completed_at ?? null,
    imports: (imports ?? []).map((row) => ({
      id: row.id,
      sourceDate: row.source_date,
      status: row.status,
      sponsorCount: row.sponsor_count,
      routeCount: row.route_count,
      addedCount: row.added_count,
      reactivatedCount: row.reactivated_count,
      deactivatedCount: row.deactivated_count,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    })),
  };
}
