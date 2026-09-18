import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { ADMIN_PERMISSIONS, type AdminPermission } from "@/lib/admin/permission-types";

export { ADMIN_PERMISSIONS, ADMIN_PERMISSION_LABELS, type AdminPermission } from "@/lib/admin/permission-types";

type AdminRoleRow = { permissions: string[]; is_active: boolean };

function isAdminPermission(value: string): value is AdminPermission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * Every permission this account currently holds, across every active
 * role it's been granted (migration 0075: the union of all of
 * `admin_user_roles` -> `admin_roles.permissions`) — the one query the
 * admin sidebar and every `hasPermission`/`requirePermission` call
 * below is built on. Fails closed to an empty set on any query error,
 * same "a missing/unreadable answer is never treated as granted"
 * philosophy src/lib/entitlements/service.ts already applies to plan
 * entitlements.
 */
export async function getGrantedPermissions(userId: string): Promise<Set<AdminPermission>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("admin_user_roles").select("admin_roles(permissions, is_active)").eq("user_id", userId);
  if (error || !data) return new Set();

  const granted = new Set<AdminPermission>();
  for (const row of data) {
    const relation = row.admin_roles as AdminRoleRow[] | AdminRoleRow | null;
    const role = Array.isArray(relation) ? relation[0] : relation;
    if (!role?.is_active) continue;
    for (const permission of role.permissions ?? []) {
      if (isAdminPermission(permission)) granted.add(permission);
    }
  }
  return granted;
}

export async function hasPermission(userId: string, permission: AdminPermission): Promise<boolean> {
  const granted = await getGrantedPermissions(userId);
  return granted.has(permission);
}

/**
 * The route guard for one specific admin section — calls
 * requireAdmin() first (the unchanged base "is this account staff at
 * all" gate), then checks the specific permission on top. A staff
 * account that's missing the permission bounces to `/admin` (the
 * overview they *do* have access to), not all the way out to
 * `/dashboard` the way failing the base gate does — this is a narrower,
 * less disruptive failure than not being staff at all.
 */
export async function requirePermission(permission: AdminPermission) {
  const { user, profile } = await requireAdmin();
  if (!(await hasPermission(user.id, permission))) {
    redirect("/admin");
  }
  return { user, profile };
}
