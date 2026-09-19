const DEFAULT_REDIRECT = "/dashboard";

function isSafeRelativePath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("://")
  );
}

/**
 * The explicit redirect target if `value` is a safe same-site relative
 * path, or `null` if there wasn't one (absent or invalid) — never
 * substitutes a default itself. Callers that need a role-aware default
 * instead of the plain one (post-login, guest-only-page bounce) resolve
 * that separately and only fall back to it when this returns null,
 * rather than baking "no redirect requested" and "an explicit /dashboard
 * redirect" into the same value.
 */
export function parseRedirectParam(value: unknown): string | null {
  return isSafeRelativePath(value) ? value : null;
}

/**
 * Only ever redirect to a same-site relative path after login. A
 * user-controlled `redirect` query param must never be trusted as-is —
 * that's an open-redirect vector (e.g. `//evil.com` or `https://evil.com`).
 * `fallback` lets a caller substitute a role-aware default (see
 * src/lib/auth/role-redirect.ts) instead of the plain one below, for
 * flows where the signed-in user's role is already known.
 */
export function toSafeRedirectPath(value: unknown, fallback: string = DEFAULT_REDIRECT): string {
  return parseRedirectParam(value) ?? fallback;
}
