"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { updateAppSettingsSchema } from "@/lib/admin/settings/schemas";

/**
 * The regular client is enough here — app_settings' own "Admins with
 * manage_settings can update" RLS policy (migration 0078) already
 * checks exactly the permission requirePermission() just verified, for
 * exactly this acting admin's own auth.uid(). No service-role client
 * needed for a write RLS itself already permits.
 */
export async function updateAppSettings(_prevState: unknown, formData: FormData) {
  const { user } = await requirePermission("manage_settings");

  const parsed = updateAppSettingsSchema.safeParse({
    maintenanceMode: formData.get("maintenanceMode"),
    announcementActive: formData.get("announcementActive"),
    announcementMessage: formData.get("announcementMessage"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({
      maintenance_mode: parsed.data.maintenanceMode,
      announcement_active: parsed.data.announcementActive,
      announcement_message: parsed.data.announcementMessage,
      updated_by: user.id,
    })
    .eq("id", 1);
  if (error) return { error: "Couldn't save settings — try again." };

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "app_settings.update",
    entityType: "app_settings",
    entityId: "1",
    metadata: { maintenanceMode: parsed.data.maintenanceMode, announcementActive: parsed.data.announcementActive },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard", "layout");
}
