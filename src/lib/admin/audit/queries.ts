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
  // Searched in the database, before the row limit: filtering the newest 200 rows afterwards would miss any older entry. The characters
  // that mean something inside a PostgREST filter list and the % wildcard are dropped from the term.
  const term = filters.search?.replace(/[,()%*"']/g, " ").trim();
  if (term) query = query.or(`action.ilike.%${term}%,actor_email.ilike.%${term}%,entity_id.ilike.%${term}%`);

  const { data, error } = await query;
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
