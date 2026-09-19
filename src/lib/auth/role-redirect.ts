import type { AdminUserRole } from "@/lib/admin/users/types";

/**
 * Each role's own landing page — the post-login default when nothing
 * more specific was requested, and where a role gets sent when it's
 * bounced off a route it doesn't belong on (a protected area for
 * another role, or a guest-only page like /login while already
 * signed in). `profiles.role` is immutable except via service-role
 * (migration 0051), so this only ever reflects a real, intentional
 * role assignment — never something a user could self-select.
 */
export function getRoleHomePath(role: AdminUserRole | string | null | undefined): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "institution_admin":
      return "/institution-admin";
    default:
      return "/dashboard";
  }
}
