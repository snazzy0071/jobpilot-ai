// Mirrors scripts/import-sponsors.mjs's own collapseWhitespace/
// normalizeForMatch exactly — a search term typed by a visitor has to
// be normalized the *same* way the importer normalized what's actually
// stored (company_name_normalized/town_city_normalized/
// alias_name_normalized), or an otherwise-matching search would miss
// real rows over nothing more than whitespace/casing differences. No
// TypeScript runner is set up for the standalone importer script (see
// its own header comment), so this can't be imported there — kept in
// sync by hand instead, same as src/lib/sponsors/types.ts already notes
// for the rating-bucket logic.

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
