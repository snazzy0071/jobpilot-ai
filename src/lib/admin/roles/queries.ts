import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRole, AdminAccount, AdminRoleAssignment } from "@/lib/admin/roles/types";

/** Any admin can view every role (RLS, migration 0075) — writing them needs manage_admin_roles specifically. */
export async function listAdminRoles(): Promise<AdminRole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("admin_roles").select("id, slug, name, description, permissions, is_active").order("name");
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    permissions: (row.permissions ?? []) as AdminRole["permissions"],
    isActive: row.is_active,
  }));
}

export async function getAdminRoleById(id: string): Promise<AdminRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_roles")
    .select("id, slug, name, description, permissions, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    permissions: (data.permissions ?? []) as AdminRole["permissions"],
    isActive: data.is_active,
  };
}

/**
 * Every account flagged `profiles.role = 'admin'` — the pool a role
 * can be granted to. Needs the service-role client: `profiles`' own
 * RLS is self-select only, and email lives in `auth.users`, not
 * `profiles`, at all — same reasoning and same
 * `auth.admin.getUserById` pattern
 * src/lib/institutions/admin/queries.ts's listInstitutionMembers
 * already documents.
 */
export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const admin = createAdminClient();
  const { data: profiles, error } = await admin.from("profiles").select("id, full_name").eq("role", "admin");
  if (error || !profiles) return [];

  return Promise.all(
    profiles.map(async (profile) => {
      const { data } = await admin.auth.admin.getUserById(profile.id);
      return { userId: profile.id, fullName: profile.full_name, email: data.user?.email ?? null };
    }),
  );
}

/** Same service-role reasoning as listAdminAccounts above, for the same "profiles/auth.users has no admin-readable RLS path" reason. */
export async function listAdminRoleAssignments(): Promise<AdminRoleAssignment[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_user_roles")
    .select("id, user_id, admin_role_id, granted_at, admin_roles(name)")
    .order("granted_at", { ascending: false });
  if (error || !data || data.length === 0) return [];

  const userIds = [...new Set(data.map((row) => row.user_id))];
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", userIds);
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  const emailById = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data: userData } = await admin.auth.admin.getUserById(userId);
      emailById.set(userId, userData.user?.email ?? null);
    }),
  );

  return data.map((row) => {
    const relation = row.admin_roles as { name: string }[] | { name: string } | null;
    const role = Array.isArray(relation) ? relation[0] : relation;
    return {
      id: row.id,
      userId: row.user_id,
      adminRoleId: row.admin_role_id,
      roleName: role?.name ?? "Unknown role",
      userFullName: nameById.get(row.user_id) ?? null,
      userEmail: emailById.get(row.user_id) ?? null,
      grantedAt: row.granted_at,
    };
  });
}
