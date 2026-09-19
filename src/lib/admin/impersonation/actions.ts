"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { startImpersonationSession } from "@/lib/auth/impersonation";
import { createAdminClient } from "@/lib/supabase/admin";

const targetUserIdSchema = z.object({ targetUserId: z.string().uuid() });

export type ImpersonationActionResult = { error: string } | void;

/**
 * From /admin/users/[id] only. requirePermission("manage_users") is
 * the same gate that whole section is already behind
 * (src/app/admin/users/layout.tsx) — this doesn't loosen or duplicate
 * that check, just re-runs it here since a Server Action is its own
 * entry point and can be called directly, not only via the page that
 * happens to render its trigger button. startImpersonationSession()
 * itself re-validates the target is a plain 'user' account (and the
 * database trigger from migration 0087 would reject the insert even if
 * this check were ever bypassed) — never an admin or institution_admin,
 * which is what actually closes off the privilege-escalation angle
 * (a lesser-permissioned admin using this to inherit a colleague's own
 * admin-role grants).
 */
export async function startImpersonation(_prevState: ImpersonationActionResult, formData: FormData): Promise<ImpersonationActionResult> {
  const { user: actingAdmin } = await requirePermission("manage_users");

  const parsed = targetUserIdSchema.safeParse({ targetUserId: formData.get("targetUserId") });
  if (!parsed.success) return { error: "Invalid request." };

  const result = await startImpersonationSession(actingAdmin.id, parsed.data.targetUserId);
  if ("error" in result) return { error: result.error };

  const admin = createAdminClient();
  const { data: targetAuthUser } = await admin.auth.admin.getUserById(parsed.data.targetUserId);

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "user.impersonate_start",
    entityType: "user",
    entityId: parsed.data.targetUserId,
    metadata: {
      impersonationSessionId: result.id,
      targetEmail: targetAuthUser.user?.email ?? null,
    },
  });

  redirect("/dashboard");
}
