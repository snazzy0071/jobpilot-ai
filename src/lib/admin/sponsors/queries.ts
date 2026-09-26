import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSponsorSyncDispatchConfig } from "@/lib/admin/sponsors/dispatch-config";
import { deriveSponsorSyncState, SPONSOR_SYNC_STALE_AFTER_HOURS } from "@/lib/admin/sponsors/sync-state";
import type { AdminSponsorChange, AdminSponsorSyncOverview } from "@/lib/admin/sponsors/types";

const IMPORT_HISTORY_LIMIT = 20;
const LATEST_CHANGES_LIMIT = 50;

/**
 * Sync health for the admin page: is it running, is it fresh, what did the last run change. `sponsor_imports` and
 * `sponsor_sync_changes` are readable by anyone (migrations 0049/0054), so the regular client covers the history;
 * `sponsors` itself hides inactive rows from the public policy, so the honest active/inactive/total counts need the
 * service-role client.
 */
export async function getSponsorSyncOverview(): Promise<AdminSponsorSyncOverview> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: imports }, { data: statusRow }, active, inactive] = await Promise.all([
    supabase
      .from("sponsor_imports")
      .select(
        "id, source_date, status, sponsor_count, route_count, added_count, reactivated_count, deactivated_count, routes_removed_count, aliases_removed_count, error_message, started_at, completed_at",
      )
      .order("started_at", { ascending: false })
      .limit(IMPORT_HISTORY_LIMIT),
    supabase.from("sponsor_sync_status").select("import_id, source_date, completed_at").maybeSingle(),
    admin.from("sponsors").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("sponsors").select("id", { count: "exact", head: true }).eq("is_active", false),
  ]);

  const latest = imports?.[0] ?? null;

  // What the last completed sync changed — only removals and returns are listed; "added" is the whole register on a
  // first sync, so it's shown as a count on the import row instead.
  let latestChanges: AdminSponsorChange[] = [];
  if (statusRow?.import_id) {
    const { data: changes } = await supabase
      .from("sponsor_sync_changes")
      .select("change_type, company_name, sponsor_id, import_id, created_at")
      .eq("import_id", statusRow.import_id)
      .in("change_type", ["deactivated", "reactivated"])
      .order("created_at", { ascending: false })
      .limit(LATEST_CHANGES_LIMIT);
    latestChanges = (changes ?? []).map((row) => ({
      changeType: row.change_type,
      companyName: row.company_name,
      sponsorId: row.sponsor_id,
      importId: row.import_id,
      createdAt: row.created_at,
    }));
  }

  return {
    state: deriveSponsorSyncState({
      latestStatus: latest?.status ?? null,
      latestStartedAt: latest?.started_at ?? null,
      lastCompletedAt: statusRow?.completed_at ?? null,
    }),
    staleAfterHours: SPONSOR_SYNC_STALE_AFTER_HOURS,
    activeSponsorCount: active.count ?? 0,
    inactiveSponsorCount: inactive.count ?? 0,
    totalSponsorCount: (active.count ?? 0) + (inactive.count ?? 0),
    lastCompletedAt: statusRow?.completed_at ?? null,
    lastSourceDate: statusRow?.source_date ?? null,
    latestChanges,
    canTriggerSync: getSponsorSyncDispatchConfig() !== null,
    imports: (imports ?? []).map((row) => ({
      id: row.id,
      sourceDate: row.source_date,
      status: row.status,
      sponsorCount: row.sponsor_count,
      routeCount: row.route_count,
      addedCount: row.added_count,
      reactivatedCount: row.reactivated_count,
      deactivatedCount: row.deactivated_count,
      routesRemovedCount: row.routes_removed_count,
      aliasesRemovedCount: row.aliases_removed_count,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    })),
  };
}
