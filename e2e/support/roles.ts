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

/**
 * Makes an isolated account an institution admin: `profiles.role =
 * 'institution_admin'` plus a throwaway institution with an active licence and an admin
 * membership row (what requireInstitutionAdmin resolves the tenant from).
 * Returns the institution id so the caller can delete it afterwards
 * (membership rows cascade from the institution).
 */
export async function makeInstitutionAdmin(userId: string): Promise<string> {
  const admin = getAdminClient();
  const { error: roleError } = await admin.from("profiles").update({ role: "institution_admin", onboarding_status: "completed" }).eq("id", userId);
  if (roleError) throw new Error(`e2e/support/roles.ts: couldn't flag ${userId} as institution admin: ${roleError.message}`);

  const slug = `e2e-inst-${userId.slice(0, 8)}-${Date.now()}`;
  const { data: institution, error: instError } = await admin.from("institutions").insert({ name: "E2E Institution", slug }).select("id").single();
  if (instError || !institution) throw new Error(`e2e/support/roles.ts: couldn't create institution: ${instError?.message}`);

  try {
    // The seat-capacity trigger refuses a member row for an institution with no active licence.
    const { data: plan, error: planError } = await admin.from("plans").select("id").limit(1).single();
    if (planError || !plan) throw new Error(`e2e/support/roles.ts: no plan to attach a licence to: ${planError?.message}`);
    const { error: licenceError } = await admin.from("institution_licences").insert({ institution_id: institution.id, plan_id: plan.id, seat_count: 5 });
    if (licenceError) throw new Error(`e2e/support/roles.ts: couldn't create licence: ${licenceError.message}`);

    const { error: memberError } = await admin.from("institution_members").insert({ institution_id: institution.id, user_id: userId, role: "admin" });
    if (memberError) throw new Error(`e2e/support/roles.ts: couldn't add membership: ${memberError.message}`);
    return institution.id;
  } catch (error) {
    // Don't leave a half-built institution behind in the shared database when setup fails part-way.
    await admin.from("institutions").delete().eq("id", institution.id);
    throw error;
  }
}

/**
 * Puts an isolated account on a paid plan (`pro`, `premium` or `elite`) the way a completed checkout would leave it:
 * an active `subscriptions` row pointing at the plan. Lets a spec use features the Free plan caps (several CVs,
 * AI rewrites) without going through Stripe. The row cascades away with the user.
 */
export async function setPlan(userId: string, slug: "pro" | "premium" | "elite"): Promise<void> {
  const admin = getAdminClient();
  const { data: plan, error: planError } = await admin.from("plans").select("id").eq("slug", slug).single();
  if (planError || !plan) throw new Error(`e2e/support/roles.ts: no "${slug}" plan found: ${planError?.message}`);
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("subscriptions")
    .upsert({ user_id: userId, plan_id: plan.id, status: "active", billing_cycle: "monthly", current_period_end: periodEnd }, { onConflict: "user_id" });
  if (error) throw new Error(`e2e/support/roles.ts: couldn't put ${userId} on ${slug}: ${error.message}`);
}
