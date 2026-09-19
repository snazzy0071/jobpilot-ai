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

// Areas that belong to exactly one role. Everything else (public pages,
// and the auth-flow pages /reset-password and /signup/verified that the
// email-link callbacks send people to) is valid for any role.
const ROLE_AREAS: { prefix: string; role: string }[] = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/institution-admin", role: "institution_admin" },
  { prefix: "/dashboard", role: "user" },
  { prefix: "/onboarding", role: "user" },
];

/**
 * The normalised same-site path (with query/hash) if `requested` is a safe
 * relative path, else null. Normalising resolves dot segments and encoded
 * characters, so `/dashboard/../admin` or `/%61dmin` can't slip past the
 * area check below by looking like something else.
 */
function normaliseRequested(requested: string): { path: string; pathname: string } | null {
  if (!requested.startsWith("/") || requested.startsWith("//") || requested.includes("\\") || requested.includes("://")) return null;
  try {
    const url = new URL(requested, "http://placeholder.invalid");
    if (url.origin !== "http://placeholder.invalid") return null;
    const pathname = decodeURIComponent(url.pathname).toLowerCase();
    return { path: `${url.pathname}${url.search}${url.hash}`, pathname };
  } catch {
    return null;
  }
}

/** Whether `requested` may be used as this role's landing page: role-restricted areas only for their own role. */
export function isPathValidForRole(role: AdminUserRole | string | null | undefined, requested: string): boolean {
  const parsed = normaliseRequested(requested);
  if (!parsed) return false;
  const effectiveRole = role ?? "user";
  for (const area of ROLE_AREAS) {
    if (parsed.pathname === area.prefix || parsed.pathname.startsWith(`${area.prefix}/`)) {
      return area.role === effectiveRole;
    }
  }
  return true;
}

/**
 * Where to send someone who has just authenticated (password, OAuth, email
 * link) or who opens a guest-only page like /login while signed in. An
 * explicit destination (a `redirect`/`next` param) is kept only if it is
 * valid for the signed-in role — a protected-page bounce from another
 * role's area falls back to the role's own home instead. So an admin is
 * never defaulted to /dashboard, and a user is never sent to /admin.
 */
export function resolvePostAuthPath(role: AdminUserRole | string | null | undefined, requested: string | null | undefined): string {
  if (requested && isPathValidForRole(role, requested)) {
    return normaliseRequested(requested)!.path;
  }
  return getRoleHomePath(role);
}
