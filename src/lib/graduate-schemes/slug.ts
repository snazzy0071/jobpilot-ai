/** URL slug for a scheme: employer + scheme name, lower-case ASCII words joined by hyphens (matches migration 0111's slug check). */
export function slugify(...parts: string[]): string {
  const slug = parts
    .join(" ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 190)
    .replace(/-+$/g, "");
  return slug || "scheme";
}

/** The first of `slug`, `slug-2`, `slug-3`, ... that isn't in `taken`. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
