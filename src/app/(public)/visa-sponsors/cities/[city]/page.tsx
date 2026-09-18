import { notFound } from "next/navigation";
import Link from "next/link";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { SponsorSearchFilters } from "@/components/marketing/sponsor-search-filters";
import { SponsorSearchResults } from "@/components/marketing/sponsor-search-results";
import { SponsorSyncDisclaimer } from "@/components/marketing/sponsor-sync-disclaimer";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import {
  searchSponsors,
  getDistinctSponsorRoutes,
  getSponsorSyncStatus,
  getSponsorCityCounts,
} from "@/lib/sponsors/queries";
import { SPONSOR_RATINGS, type SponsorRating } from "@/lib/sponsors/types";
import { SPONSOR_CITIES, getSponsorCity } from "@/config/sponsor-cities";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return SPONSOR_CITIES.map((city) => ({ city: city.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: citySlug } = await params;
  const city = getSponsorCity(citySlug);
  if (!city) return { title: "City not found" };

  const [cityCount] = await getSponsorCityCounts([city]);

  return buildMetadata({
    title: `Visa Sponsors in ${city.name}`,
    description:
      cityCount.count > 0
        ? `${cityCount.count.toLocaleString()} licensed UK visa sponsors based in ${city.name}, from the Home Office's public register.`
        : `Licensed UK visa sponsors based in ${city.name}, from the Home Office's public register.`,
    path: `/visa-sponsors/cities/${city.slug}`,
  });
}

type SearchParams = { company?: string; route?: string; rating?: string; page?: string };

function isSponsorRating(value: string | undefined): value is SponsorRating {
  return !!value && (SPONSOR_RATINGS as readonly string[]).includes(value);
}

export default async function SponsorCityPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { city: citySlug } = await params;
  const city = getSponsorCity(citySlug);
  if (!city) notFound();

  const query = await searchParams;
  const rating = isSponsorRating(query.rating) ? query.rating : undefined;
  // The city itself always comes from the URL path (city.name), never
  // an editable query param on this page — the filter form still lets
  // someone narrow further by company/route/rating, but changing "town/
  // city" here would just mean "go search /visa-sponsors instead",
  // which is what that field's real behaviour already does once
  // submitted (see SponsorSearchFilters — it always navigates to
  // `basePath`, so leaving `basePath` as this city's own URL keeps a
  // narrower city-text edit from silently leaving this page).
  const filters = {
    company: query.company,
    city: city.name,
    route: query.route,
    rating,
    page: query.page ? Number(query.page) || 1 : 1,
  };
  const basePath = `/visa-sponsors/cities/${city.slug}`;

  const [result, routes, syncStatus, cityCounts] = await Promise.all([
    searchSponsors(filters),
    getDistinctSponsorRoutes(),
    getSponsorSyncStatus(),
    getSponsorCityCounts(SPONSOR_CITIES),
  ]);
  const thisCityCount = cityCounts.find((c) => c.slug === city.slug)?.count ?? 0;
  const otherCities = cityCounts.filter((c) => c.slug !== city.slug);

  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="w-full self-start">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Visa Sponsors", href: "/visa-sponsors" },
                { label: "Cities", href: "/visa-sponsors/cities" },
                { label: city.name },
              ]}
            />
          </div>
          <Eyebrow>
            <Link href="/visa-sponsors/cities" className="hover:underline">
              Browse by city
            </Link>
          </Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Visa sponsors in {city.name}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {thisCityCount > 0
              ? `${thisCityCount.toLocaleString()} licensed UK sponsor${thisCityCount === 1 ? "" : "s"} based in ${city.name}, from the Home Office's public register.`
              : `Licensed UK sponsors based in ${city.name}, from the Home Office's public register.`}
          </p>
        </div>
      </Section>

      <Section tone="muted" className="pt-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <SponsorSyncDisclaimer status={syncStatus} />
          <SponsorSearchFilters
            basePath="/visa-sponsors"
            cityPlaceholder={city.name}
            routes={routes}
            defaultValues={{ company: query.company, city: city.name, route: query.route, rating }}
          />
          <SponsorSearchResults result={result} basePath={basePath} searchParams={query} />
        </div>
      </Section>

      <Section>
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Other UK cities</h2>
          <div className="flex flex-wrap gap-2">
            {otherCities.map((otherCity) => (
              <Link
                key={otherCity.slug}
                href={`/visa-sponsors/cities/${otherCity.slug}`}
                className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
              >
                {otherCity.name}
                {otherCity.count > 0 ? ` (${otherCity.count.toLocaleString()})` : ""}
              </Link>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
