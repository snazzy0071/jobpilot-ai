import "server-only";

/**
 * A same-origin check for cookie-authenticated Route Handlers that
 * mutate state or trigger a paid external API call — the same defense
 * Next.js applies automatically to Server Actions (an Origin-header
 * check against the request's own Host), applied here by hand since a
 * plain Route Handler doesn't get that for free.
 *
 * This app's session cookie is `SameSite=Lax` (Supabase's own default
 * — see `@supabase/ssr`'s `DEFAULT_COOKIE_OPTIONS`, never overridden
 * anywhere in `src/lib/supabase/*.ts`), which already stops a
 * cross-site *POST* from attaching the cookie in every modern browser.
 * This check is deliberate defense in depth on top of that, not the
 * only thing standing between these routes and CSRF — "every modern
 * browser" isn't "every browser everywhere," and this makes the actual
 * intent explicit and enforced in code rather than implicit in a cookie
 * attribute nobody reading the route handler would otherwise see.
 *
 * Fails closed: a request with no `Origin` header at all (or one that
 * fails to parse) is treated as cross-origin, never waved through on
 * good faith. A real same-origin `fetch()`/form POST from this app's
 * own pages always sends `Origin`.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
