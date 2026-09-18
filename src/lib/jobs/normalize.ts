// Mirrors src/lib/sponsors/normalize.ts exactly — same reasoning: a
// search term has to be normalized the same way a stored row's own
// title_normalized/company_name_normalized/location_normalized was, or
// an otherwise-matching search misses real rows over nothing more than
// whitespace/casing differences. Kept as its own copy per domain
// (rather than a shared util) matching that file's own precedent.

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeForMatch(value: string): string {
  return collapseWhitespace(value).toLowerCase();
}

/** Escapes Postgres LIKE/ILIKE wildcards (`%`, `_`) in a user-typed search term, so a literal percent or underscore in someone's search doesn't act as a wildcard. Applied before the term is wrapped in `%...%` for an ilike filter. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
}
