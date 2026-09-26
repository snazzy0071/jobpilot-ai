"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import {
  createAdminRoleSchema,
  updateAdminRoleSchema,
  deleteAdminRoleSchema,
  grantAdminRoleSchema,
  revokeAdminRoleSchema,
} from "@/lib/admin/roles/schemas";
import { firstRole, wouldRemoveLastRoleManager, type AssignmentRow, type RoleRelation } from "@/lib/admin/roles/lockout";

/** True if, once `excludeAssignmentId` is disregarded, no other active grant of manage_admin_roles remains anywhere in the system. */
async function isLastManageAdminRolesAssignment(supabase: Awaited<ReturnType<typeof createClient>>, excludeAssignmentId: string): Promise<boolean> {
  const { data } = await supabase.from("admin_user_roles").select("id, admin_roles(permissions, is_active)");
  return wouldRemoveLastRoleManager((data ?? []) as AssignmentRow[], (row) => row.id === excludeAssignmentId);
}

/** Same check, but "would any OTHER role still grant it if `excludeRoleId` stopped counting" — used when editing/deleting a role rather than revoking one assignment. */
async function isLastManageAdminRolesRole(supabase: Awaited<ReturnType<typeof createClient>>, excludeRoleId: string): Promise<boolean> {
  const { data } = await supabase.from("admin_user_roles").select("admin_role_id, admin_roles(permissions, is_active)");
  return wouldRemoveLastRoleManager((data ?? []) as AssignmentRow[], (row) => row.admin_role_id === excludeRoleId);
}

const LOCKOUT_MESSAGE = "This is the last role/account that can manage admin roles — grant it elsewhere before making this change.";

export async function createAdminRole(formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_admin_roles");

  const parsed = createAdminRoleSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description"),
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_roles")
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "That slug is already in use." };
    return { error: "Couldn't create that role — try again." };
  }

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "admin_role.create",
    entityType: "admin_role",
    entityId: data.id,
    metadata: { slug: parsed.data.slug, permissions: parsed.data.permissions },
  });

  revalidatePath("/admin/roles");
}

export async function updateAdminRole(_prevState: unknown, formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_admin_roles");

  const parsed = updateAdminRoleSchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description"),
    permissions: formData.getAll("permissions"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: current } = await supabase.from("admin_roles").select("permissions, is_active").eq("id", parsed.data.id).maybeSingle();
  if (!current) return { error: "That role couldn't be found." };

  const currentlyGrants = current.is_active && (current.permissions as string[]).includes("manage_admin_roles");
  const willGrant = parsed.data.isActive && parsed.data.permissions.includes("manage_admin_roles");

  if (currentlyGrants && !willGrant && (await isLastManageAdminRolesRole(supabase, parsed.data.id))) {
    return { error: LOCKOUT_MESSAGE };
  }

  const { error } = await supabase
    .from("admin_roles")
    .update({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      permissions: parsed.data.permissions,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id);
  if (error) {
    if (error.code === "23505") return { error: "That slug is already in use." };
    return { error: "Couldn't update that role — try again." };
  }

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "admin_role.update",
    entityType: "admin_role",
    entityId: parsed.data.id,
    metadata: { slug: parsed.data.slug, permissions: parsed.data.permissions, isActive: parsed.data.isActive },
  });

  revalidatePath("/admin/roles");
}

export async function deleteAdminRole(_prevState: unknown, formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_admin_roles");

  const parsed = deleteAdminRoleSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();

  const { data: current } = await supabase.from("admin_roles").select("permissions, is_active").eq("id", parsed.data.id).maybeSingle();
  if (!current) return { error: "That role couldn't be found." };

  const grantsManageRoles = current.is_active && (current.permissions as string[]).includes("manage_admin_roles");
  if (grantsManageRoles && (await isLastManageAdminRolesRole(supabase, parsed.data.id))) {
    return { error: LOCKOUT_MESSAGE };
  }

  const { error } = await supabase.from("admin_roles").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that role — try again." };

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "admin_role.delete",
    entityType: "admin_role",
    entityId: parsed.data.id,
  });

  revalidatePath("/admin/roles");
}

export async function grantAdminRole(formData: FormData) {
  const { user } = await requirePermission("manage_admin_roles");

  const parsed = grantAdminRoleSchema.safeParse({
    userId: formData.get("userId"),
    adminRoleId: formData.get("adminRoleId"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.from("admin_user_roles").insert({
    user_id: parsed.data.userId,
    admin_role_id: parsed.data.adminRoleId,
    granted_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: "That account already holds this role." };
    return { error: "Couldn't grant that role — try again." };
  }

  await logAdminAction({
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "admin_user_role.grant",
    entityType: "admin_user_role",
    entityId: parsed.data.userId,
    metadata: { adminRoleId: parsed.data.adminRoleId },
  });

  revalidatePath("/admin/roles");
}

export async function revokeAdminRole(_prevState: unknown, formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_admin_roles");

  const parsed = revokeAdminRoleSchema.safeParse({ assignmentId: formData.get("assignmentId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("admin_user_roles")
    .select("id, admin_roles(permissions, is_active)")
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();
  if (!assignment) return { error: "That assignment couldn't be found." };

  const role = firstRole(assignment.admin_roles as RoleRelation);
  const grantsManageRoles = !!role?.is_active && role.permissions.includes("manage_admin_roles");

  if (grantsManageRoles && (await isLastManageAdminRolesAssignment(supabase, parsed.data.assignmentId))) {
    return { error: LOCKOUT_MESSAGE };
  }

  const { error } = await supabase.from("admin_user_roles").delete().eq("id", parsed.data.assignmentId);
  if (error) return { error: "Couldn't revoke that role — try again." };

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "admin_user_role.revoke",
    entityType: "admin_user_role",
    entityId: parsed.data.assignmentId,
  });

  revalidatePath("/admin/roles");
}
