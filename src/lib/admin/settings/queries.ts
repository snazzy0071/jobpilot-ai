import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/admin/settings/types";

const DEFAULTS: AppSettings = { maintenanceMode: false, announcementMessage: null, announcementActive: false, updatedAt: new Date(0).toISOString() };

/**
 * `app_settings` (migration 0078) is a real, wired-in singleton, not a
 * speculative knob: `maintenanceMode` gates `signUpWithPassword`
 * (src/lib/auth/actions.ts), `announcementMessage`/`announcementActive`
 * render as a real banner in `/(dashboard)/layout.tsx`. Public read
 * RLS ("Anyone can view app settings") means both an anonymous signup
 * attempt and any signed-in dashboard page can read this with the
 * regular client — no service-role needed. Fails closed to "not in
 * maintenance, no announcement" if the row is somehow unreadable,
 * same "a missing answer is never treated as a reason to block/alarm
 * everyone" fail-open-for-availability reasoning as elsewhere, but
 * fail-*closed* specifically for maintenance_mode since that's the
 * side that would otherwise strand every new signup.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("maintenance_mode, announcement_message, announcement_active, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return DEFAULTS;

  return {
    maintenanceMode: data.maintenance_mode,
    announcementMessage: data.announcement_message,
    announcementActive: data.announcement_active,
    updatedAt: data.updated_at,
  };
}
