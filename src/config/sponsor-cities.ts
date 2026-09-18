export type SponsorCity = {
  slug: string;
  name: string;
};

// The register sync itself doesn't exist yet — this is just the fixed list
// of major UK cities the directory will let people browse by, once it does.
export const SPONSOR_CITIES: SponsorCity[] = [
  { slug: "london", name: "London" },
  { slug: "manchester", name: "Manchester" },
  { slug: "birmingham", name: "Birmingham" },
  { slug: "edinburgh", name: "Edinburgh" },
  { slug: "glasgow", name: "Glasgow" },
  { slug: "leeds", name: "Leeds" },
  { slug: "bristol", name: "Bristol" },
  { slug: "liverpool", name: "Liverpool" },
];

export function getSponsorCity(slug: string): SponsorCity | undefined {
  return SPONSOR_CITIES.find((city) => city.slug === slug);
}
