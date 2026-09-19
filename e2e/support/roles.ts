import { getAdminClient } from "./admin-client";

/**
 * Turns an isolated test account into a fully onboarded plain user, so
 * it lands on /dashboard instead of being bounced to /onboarding. Done
 * through the service role (same as scripts/create-user.mjs) rather than
 * by clicking through the three onboarding steps: the audit specs are
 * testing what happens after onboarding, not onboarding itself
 * (e2e/onboarding covers that).
 */
export async function markOnboarded(userId: string): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from("profiles").update({ onboarding_status: "completed" }).eq("id", userId);
  if (error) throw new Error(`e2e/support/roles.ts: couldn't mark ${userId} onboarded: ${error.message}`);
}

/**
 * Makes an isolated account a real staff admin: `profiles.role = 'admin'`
 * (writable only by the service role, migration 0051) plus the seeded
 * `super_admin` role, so every admin permission is granted exactly the
 * way a real super admin's are.
 */
export async function makeSuperAdmin(userId: string): Promise<void> {
  const admin = getAdminClient();
  const { error: roleError } = await admin.from("profiles").update({ role: "admin", onboarding_status: "completed" }).eq("id", userId);
  if (roleError) throw new Error(`e2e/support/roles.ts: couldn't flag ${userId} as admin: ${roleError.message}`);

  const { data: role, error: lookupError } = await admin.from("admin_roles").select("id").eq("slug", "super_admin").single();
  if (lookupError || !role) throw new Error("e2e/support/roles.ts: the seeded super_admin role wasn't found.");

  const { error: grantError } = await admin.from("admin_user_roles").insert({ user_id: userId, admin_role_id: role.id });
  if (grantError) throw new Error(`e2e/support/roles.ts: couldn't grant super_admin: ${grantError.message}`);
}
