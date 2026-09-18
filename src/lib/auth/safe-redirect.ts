const DEFAULT_REDIRECT = "/dashboard";

/**
 * Only ever redirect to a same-site relative path after login. A
 * user-controlled `redirect` query param must never be trusted as-is —
 * that's an open-redirect vector (e.g. `//evil.com` or `https://evil.com`).
 */
export function toSafeRedirectPath(value: unknown): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("://")
  ) {
    return value;
  }
  return DEFAULT_REDIRECT;
}
