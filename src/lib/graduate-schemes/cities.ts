import { slugify } from "@/lib/graduate-schemes/slug";
import type { GraduateScheme } from "@/lib/graduate-schemes/types";

export type SchemeCity = { name: string; slug: string; count: number };

const key = (location: string) => slugify(location.trim());

/**
 * The places schemes are actually based, read from the published schemes themselves (nothing is listed unless a scheme names it).
 * Places that differ only in case or spacing ("london", "London ") are one place; the first spelling seen is the display name.
 */
export function cityCounts(schemes: GraduateScheme[]): SchemeCity[] {
  const cities = new Map<string, SchemeCity>();
  for (const scheme of schemes) {
    const seenInScheme = new Set<string>();
    for (const raw of scheme.locations) {
      const name = raw.trim();
      if (!name) continue;
      const slug = key(name);
      if (seenInScheme.has(slug)) continue;
      seenInScheme.add(slug);
      const existing = cities.get(slug);
      if (existing) existing.count += 1;
      else cities.set(slug, { name, slug, count: 1 });
    }
  }
  return [...cities.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function schemesForCity(schemes: GraduateScheme[], citySlug: string): GraduateScheme[] {
  return schemes.filter((scheme) => scheme.locations.some((location) => key(location) === citySlug));
}

export function findCity(schemes: GraduateScheme[], citySlug: string): SchemeCity | undefined {
  return cityCounts(schemes).find((city) => city.slug === citySlug);
}
