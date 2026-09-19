import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminAuditLogEntry, AdminAuditLogFilters } from "@/lib/admin/audit/types";

const LIST_LIMIT = 200;

/**
 * The regular client is enough here — admin_audit_logs' own SELECT
 * policy (migration 0079) already checks `view_audit_logs` directly
 * via `has_admin_permission()`, and every row already carries its own
 * `actor_email` snapshot, so there's no need to resolve anything via
 * the service-role client the way most other admin-facing "who did
 * this" lists in this app do.
 */
export async function listAdminAuditLogs(filters: AdminAuditLogFilters): Promise<AdminAuditLogEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("admin_audit_logs")
    .select("id, actor_email, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (filters.entityType) {
    query = query.eq("entity_type", filters.entityType);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  let entries: AdminAuditLogEntry[] = data.map((row) => ({
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }));

  if (filters.search) {
    const term = filters.search.trim().toLowerCase();
    entries = entries.filter(
      (entry) =>
        entry.action.toLowerCase().includes(term) ||
        (entry.actorEmail ?? "").toLowerCase().includes(term) ||
        (entry.entityId ?? "").toLowerCase().includes(term),
    );
  }

  return entries;
}

export async function listAuditEntityTypes(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("admin_audit_logs").select("entity_type");
  if (error || !data) return [];
  return Array.from(new Set(data.map((row) => row.entity_type))).sort();
}

/** The newest few entries, for the admin overview — same RLS-gated regular client as the full list above. */
export async function listRecentAdminActivity(limit = 8): Promise<AdminAuditLogEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("id, actor_email, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}
