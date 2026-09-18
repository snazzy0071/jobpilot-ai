import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AdminEmailLogEntry, AdminEmailLogFilters } from "@/lib/admin/email-logs/types";

const LIST_LIMIT = 200;

/** The regular client is enough — email_send_logs' own SELECT policy (migration 0081) already checks `view_email_logs` directly via `has_admin_permission()`. */
export async function listAdminEmailLogs(filters: AdminEmailLogFilters): Promise<AdminEmailLogEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("email_send_logs")
    .select("id, recipient, template, status, attempts, error_name, created_at")
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (filters.template) query = query.eq("template", filters.template);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    recipient: row.recipient,
    template: row.template,
    status: row.status,
    attempts: row.attempts,
    errorName: row.error_name,
    createdAt: row.created_at,
  }));
}

export async function listEmailTemplates(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("email_send_logs").select("template");
  if (error || !data) return [];
  return Array.from(new Set(data.map((row) => row.template))).sort();
}
