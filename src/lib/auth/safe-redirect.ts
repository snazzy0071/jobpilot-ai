const DEFAULT_REDIRECT = "/dashboard";

/**
 * A same-site path and nothing else. Beyond "starts with a single slash" this rejects what browsers quietly normalise into a
 * different host: a backslash (`/\\evil.com` is read as `//evil.com`), tabs/newlines/control characters (stripped by the URL
 * parser, so `/<tab>/evil.com` becomes `//evil.com`) and any whitespace. It then resolves the value against a placeholder origin
 * and requires it to stay there, so nothing the parser can turn into another origin gets through.
 */
export function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return false;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return false;
  if (/[\\\u0000-\u001f\u007f\s]/.test(value)) return false;
  try {
    return new URL(value, "http://safe.invalid").origin === "http://safe.invalid";
  } catch {
    return false;
  }
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
