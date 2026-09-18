import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminInstitutionListItem, AdminInstitutionDetail } from "@/lib/admin/institutions/types";

function firstOf<T>(value: T[] | T | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export async function listPlanOptions(): Promise<{ id: string; slug: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("id, slug, name").eq("is_active", true).order("tier_order");
  if (error || !data) return [];
  return data;
}

/**
 * The regular client is enough for everything here except resolving
 * admin emails: `institutions`/`institution_members`/
 * `institution_licences`'s own RLS (migration 0072) already gives a
 * global `profiles.role = 'admin'` account full visibility across
 * *every* institution via the fallback clause every one of those
 * policies carries — this global admin surface is exactly what that
 * fallback exists for.
 */
export async function listAdminInstitutions(): Promise<AdminInstitutionListItem[]> {
  const supabase = await createClient();
  const [{ data: institutions }, { data: members }, { data: licences }] = await Promise.all([
    supabase.from("institutions").select("id, name, slug, created_at").order("name"),
    supabase.from("institution_members").select("institution_id"),
    supabase.from("institution_licences").select("institution_id").eq("is_active", true),
  ]);
  if (!institutions) return [];

  const memberCounts = new Map<string, number>();
  for (const member of members ?? []) {
    memberCounts.set(member.institution_id, (memberCounts.get(member.institution_id) ?? 0) + 1);
  }
  const activeLicenceInstitutionIds = new Set((licences ?? []).map((licence) => licence.institution_id));

  return institutions.map((institution) => ({
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    memberCount: memberCounts.get(institution.id) ?? 0,
    hasActiveLicence: activeLicenceInstitutionIds.has(institution.id),
    createdAt: institution.created_at,
  }));
}

/** Resolving each admin's email needs the service-role client (`profiles` has no email column, `auth.users` isn't reachable via the regular client) — same pattern as every other admin-facing member list in this app. */
export async function getAdminInstitutionDetail(id: string): Promise<AdminInstitutionDetail | null> {
  const supabase = await createClient();

  const { data: institution } = await supabase.from("institutions").select("id, name, slug, created_at").eq("id", id).maybeSingle();
  if (!institution) return null;

  const [{ data: licenceRow }, { data: adminMembers }] = await Promise.all([
    supabase
      .from("institution_licences")
      .select("id, seat_count, starts_at, expires_at, is_active, plans(name)")
      .eq("institution_id", id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("institution_members").select("user_id").eq("institution_id", id).eq("role", "admin"),
  ]);

  const admin = createAdminClient();
  const adminUserIds = (adminMembers ?? []).map((member) => member.user_id);
  const { data: profiles } = adminUserIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", adminUserIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  const admins = await Promise.all(
    adminUserIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      return { userId, fullName: nameById.get(userId) ?? null, email: data.user?.email ?? null };
    }),
  );

  const plan = firstOf(licenceRow?.plans as { name: string }[] | { name: string } | null);

  return {
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    createdAt: institution.created_at,
    licence: licenceRow
      ? {
          id: licenceRow.id,
          planName: plan?.name ?? "Unknown plan",
          seatCount: licenceRow.seat_count,
          startsAt: licenceRow.starts_at,
          expiresAt: licenceRow.expires_at,
          isActive: licenceRow.is_active,
        }
      : null,
    admins,
  };
}
