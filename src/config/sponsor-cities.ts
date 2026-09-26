export type SponsorCity = {
  slug: string;
  name: string;
};

// The fixed list of major UK cities the directory lets people browse by — counts for each come from the real
// register (sponsor_city_counts), not from this file.
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
