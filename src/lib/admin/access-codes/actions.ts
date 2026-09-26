"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { createAccessCodeSchema, accessCodeIdSchema } from "@/lib/admin/access-codes/schemas";

/** Not cryptographically sensitive the way an invite/reset token is — a code is meant to be typed by a person, so it's short and human-readable, not a bearer secret. Collision odds are astronomically low at this app's scale (36^10) and the table's own unique constraint on `code` is the actual backstop either way. */
function generateAccessCode(): string {
  return randomBytes(8).toString("hex").toUpperCase().slice(0, 10);
}

/**
 * Grants nothing by itself — same reasoning migration 0005's own
 * comment gives: redemption (and any plan it grants) only ever
 * happens through redeem_access_code(), never a direct write from
 * here. This action only ever creates the *offer*, not the grant.
 */
export async function createAccessCode(formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_access_codes");

  const parsed = createAccessCodeSchema.safeParse({
    code: formData.get("code"),
    label: formData.get("label"),
    maxRedemptions: formData.get("maxRedemptions"),
    expiresAt: formData.get("expiresAt"),
    // Absent (not empty) when "None" is chosen: FormData.get() gives null, which the optional schema fields reject.
    institutionId: formData.get("institutionId") ?? undefined,
    grantedPlanId: formData.get("grantedPlanId") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const code = parsed.data.code ?? generateAccessCode();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_codes")
    .insert({
      code,
      label: parsed.data.label,
      max_redemptions: parsed.data.maxRedemptions ?? null,
      expires_at: parsed.data.expiresAt,
      institution_id: parsed.data.institutionId,
      granted_plan_id: parsed.data.grantedPlanId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "That code is already in use." };
    return { error: "Couldn't create that access code — try again." };
  }

  // The code itself isn't a bearer secret (it's meant to be typed by a
  // person — see generateAccessCode's own comment), so it's safe to
  // keep in the audit trail alongside its other terms.
  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "access_code.create",
    entityType: "access_code",
    entityId: data.id,
    metadata: { code, label: parsed.data.label, maxRedemptions: parsed.data.maxRedemptions ?? null },
  });

  revalidatePath("/admin/access-codes");
}

export async function setAccessCodeActive(_prevState: unknown, formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_access_codes");

  const parsed = accessCodeIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };
  const isActive = formData.get("isActive") === "true";

  const admin = createAdminClient();
  const { error } = await admin.from("access_codes").update({ is_active: isActive }).eq("id", parsed.data.id);
  if (error) return { error: "Couldn't update that access code — try again." };

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: isActive ? "access_code.reactivate" : "access_code.deactivate",
    entityType: "access_code",
    entityId: parsed.data.id,
  });

  revalidatePath("/admin/access-codes");
}
