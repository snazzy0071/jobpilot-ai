// Explicit, not left to @supabase/ssr's own defaults (path: "/",
// sameSite: "lax", no Secure flag) — sameSite: "lax" is kept (it's
// already the right CSRF-relevant default — see
// src/lib/security/same-origin.ts's own comment on why that alone
// isn't treated as sufficient), but Secure is forced on in production
// so the session cookie is never sent over a plain HTTP connection.
// Conditional on NODE_ENV, not hardcoded `true`: a `Secure` cookie is
// rejected outright by the browser when set over a non-HTTPS
// connection, so hardcoding it would silently break sign-in on local
// http://localhost dev. No `server-only` guard here — this file is
// shared by src/lib/supabase/client.ts too, which runs in the browser,
// and nothing in it is sensitive (booleans/strings, not a secret).
export const supabaseCookieOptions = {
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
