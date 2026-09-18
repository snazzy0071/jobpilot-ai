"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { isSeatCapacityError } from "@/lib/institutions/errors";
import { createInstitutionSchema, createLicenceSchema, licenceIdSchema, addInstitutionAdminSchema } from "@/lib/admin/institutions/schemas";

const LIST_USERS_PAGE_SIZE = 1000;
const MAX_LIST_USERS_PAGES = 20;

/** Same bounded-pagination email lookup scripts/promote-admin.mjs's own findUserByEmail already establishes — there's no server-side "get by email" in the admin API. */
async function findUserIdByEmail(admin: ReturnType<typeof createAdminClient>, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= MAX_LIST_USERS_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LIST_USERS_PAGE_SIZE });
    if (error || !data) return null;
    const match = data.users.find((user) => (user.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < LIST_USERS_PAGE_SIZE) break;
  }
  return null;
}

/** RLS ("Admins can insert institutions", migration 0072) already permits this via the regular client — no service-role needed for a plain global-admin insert. */
export async function createInstitution(formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_institutions");

  const parsed = createInstitutionSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.from("institutions").insert({ name: parsed.data.name, slug: parsed.data.slug }).select("id").single();
  if (error) {
    if (error.code === "23505") return { error: "That slug is already in use." };
    return { error: "Couldn't create that institution — try again." };
  }

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "institution.create",
    entityType: "institution",
    entityId: data.id,
    metadata: { name: parsed.data.name, slug: parsed.data.slug },
  });

  revalidatePath("/admin/institutions");
  return { id: data.id as string };
}

/**
 * RLS ("Admins can insert licences") permits this via the regular
 * client. A second active licence for the same institution hits
 * migration 0072's own partial unique index
 * (institution_licences_one_active_per_institution) — surfaced here
 * as a clear "deactivate the current one first" message rather than a
 * raw constraint error.
 */
export async function createInstitutionLicence(formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_institutions");

  const parsed = createLicenceSchema.safeParse({
    institutionId: formData.get("institutionId"),
    planId: formData.get("planId"),
    seatCount: formData.get("seatCount"),
    expiresAt: formData.get("expiresAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("institution_licences").insert({
    institution_id: parsed.data.institutionId,
    plan_id: parsed.data.planId,
    seat_count: parsed.data.seatCount,
    expires_at: parsed.data.expiresAt,
  });
  if (error) {
    if (error.code === "23505") return { error: "This institution already has an active licence — deactivate it first." };
    return { error: "Couldn't create that licence — try again." };
  }

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "institution_licence.create",
    entityType: "institution_licence",
    entityId: parsed.data.institutionId,
    metadata: { planId: parsed.data.planId, seatCount: parsed.data.seatCount },
  });

  revalidatePath(`/admin/institutions/${parsed.data.institutionId}`);
}

export async function deactivateInstitutionLicence(_prevState: unknown, formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_institutions");

  const parsed = licenceIdSchema.safeParse({ licenceId: formData.get("licenceId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: licence, error: fetchError } = await supabase
    .from("institution_licences")
    .select("institution_id")
    .eq("id", parsed.data.licenceId)
    .maybeSingle();
  if (fetchError || !licence) return { error: "That licence couldn't be found." };

  const { error } = await supabase.from("institution_licences").update({ is_active: false }).eq("id", parsed.data.licenceId);
  if (error) return { error: "Couldn't deactivate that licence — try again." };

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "institution_licence.deactivate",
    entityType: "institution_licence",
    entityId: licence.institution_id,
  });

  revalidatePath(`/admin/institutions/${licence.institution_id}`);
}

/**
 * Two writes, same shape accept_institution_invite() (migration 0072)
 * already uses for the invite-acceptance path: insert into
 * institution_members (regular client — the global-admin fallback on
 * that table's own INSERT policy covers this), then promote
 * profiles.role to 'institution_admin' *only* if it's still the
 * default 'user' (service-role client — required regardless of who's
 * asking, since the role-immutability trigger blocks any
 * `authenticated` session, including this acting admin's own). Needs
 * an active licence to already exist — enforce_institution_seat_capacity()
 * (migration 0072/0073) is what actually enforces that; a missing
 * licence surfaces here as a clear message instead of a raw exception.
 */
export async function addInstitutionAdmin(formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_institutions");

  const parsed = addInstitutionAdminSchema.safeParse({
    institutionId: formData.get("institutionId"),
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const userId = await findUserIdByEmail(admin, parsed.data.email);
  if (!userId) return { error: "No account found with that email — they need to sign up first." };

  const supabase = await createClient();
  const { error } = await supabase.from("institution_members").insert({
    institution_id: parsed.data.institutionId,
    user_id: userId,
    role: "admin",
  });
  if (error) {
    if (isSeatCapacityError(error.message)) return { error: "This institution has no seats left — add a licence or free up a seat first." };
    if (error.code === "23505") return { error: "That account already belongs to an institution." };
    return { error: "Couldn't add that admin — try again." };
  }

  await admin.from("profiles").update({ role: "institution_admin" }).eq("id", userId).eq("role", "user");

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "institution_member.add_admin",
    entityType: "institution_member",
    entityId: parsed.data.institutionId,
    metadata: { grantedToEmail: parsed.data.email },
  });

  revalidatePath(`/admin/institutions/${parsed.data.institutionId}`);
}
