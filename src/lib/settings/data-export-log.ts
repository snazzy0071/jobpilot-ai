import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Best-effort, same as logAdminAction (src/lib/admin/audit/log.ts) — a
 * logging failure must never turn an already-succeeded export into an
 * error response. Records only that an export happened, by whom, and in
 * what format — never the exported content, which is the whole point of
 * "safe" here. Inserted via the regular session-bound client, not the
 * service-role client: RLS (`auth.uid() = user_id`) is exactly the
 * guarantee wanted here — this call can only ever log the signed-in
 * caller as themselves, never forge an entry for anyone else.
 */
export async function logDataExportRequest(userId: string, format: "json" | "zip"): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("data_export_logs").insert({ user_id: userId, format });
  if (error) {
    console.error("logDataExportRequest failed:", error.message);
  }
}
