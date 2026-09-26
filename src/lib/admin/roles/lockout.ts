export type RoleRelation = { permissions: string[]; is_active: boolean } | { permissions: string[]; is_active: boolean }[] | null;

export type AssignmentRow = { id?: string; admin_role_id?: string; admin_roles: RoleRelation };

export function firstRole(relation: RoleRelation): { permissions: string[]; is_active: boolean } | undefined {
  return Array.isArray(relation) ? relation[0] : relation ?? undefined;
}

/**
 * True when disregarding `ignore` leaves no active grant of `manage_admin_roles` anywhere, i.e. the change would lock everyone out of
 * role management. Pure, so the rule is unit-tested; the actions only supply the rows.
 */
export function wouldRemoveLastRoleManager(rows: AssignmentRow[], ignore: (row: AssignmentRow) => boolean): boolean {
  return !rows.some((row) => {
    if (ignore(row)) return false;
    const role = firstRole(row.admin_roles);
    return !!role?.is_active && role.permissions.includes("manage_admin_roles");
  });
}
