// Scheme-specific signup: `/signup?from=grad&scheme=<slug>` remembers which graduate scheme someone came to prepare for, so it
// survives email confirmation (possibly on another device), OAuth and onboarding, and lands them in that scheme's preparation
// flow. The scheme travels with the ACCOUNT (auth user_metadata) rather than only in URLs or a cookie, so it isn't lost when the
// confirmation link is opened elsewhere. It is only ever a slug: it is re-validated against the published schemes wherever it is
// used, so a tampered value can at worst fail to match anything.

export const GRAD_SCHEME_METADATA_KEY = "grad_scheme_slug";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** A syntactically valid scheme slug, or null. */
export function parseSchemeSlug(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  return slug.length > 0 && slug.length <= 200 && SLUG_PATTERN.test(slug) ? slug : null;
}

/** The scheme named by a signup URL — only when it says `from=grad`. */
export function parseSchemeSignupParams(params: Record<string, string | string[] | undefined>): string | null {
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  return from === "grad" ? parseSchemeSlug(params.scheme) : null;
}

/** Where the preparation flow for a scheme lives. */
export function schemePreparePath(slug: string): string {
  return `/dashboard/graduate-schemes/${slug}/prepare`;
}

/** The signup URL for a scheme (what a scheme page's "Create account" call to action links to). */
export function schemeSignupPath(slug: string): string {
  return `/signup?from=grad&scheme=${encodeURIComponent(slug)}`;
}

/** The scheme an account arrived for, from its metadata (never trusted beyond being a slug). */
export function readPendingSchemeSlug(user: { user_metadata?: Record<string, unknown> | null } | null | undefined): string | null {
  return parseSchemeSlug(user?.user_metadata?.[GRAD_SCHEME_METADATA_KEY]);
}
