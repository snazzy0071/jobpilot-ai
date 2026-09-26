import { MapPinned } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { Section } from "@/components/marketing/section";
import { FeatureCard } from "@/components/marketing/feature-card";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { getGraduateSchemes } from "@/lib/graduate-schemes/queries";
import { cityCounts } from "@/lib/graduate-schemes/cities";
import { buildMetadata } from "@/lib/seo/metadata";

// Read per request: the places come from the published schemes, which an admin can change at any time.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "UK Graduate Schemes by City",
  description: "Browse UK graduate schemes by where they are based, with the number of published schemes in each place.",
  path: "/graduate-schemes/cities",
});

export default async function GraduateSchemeCitiesPage() {
  const cities = cityCounts(await getGraduateSchemes());

  return (
    <>
      <PageHero
        breadcrumbs={<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Graduate schemes", href: "/graduate-schemes" }, { label: "Cities" }]} />}
        eyebrow="Browse by city"
        title={
          <>
            UK graduate schemes, <GradientText>by city</GradientText>
          </>
        }
        description="Pick a place to see the schemes that say they are based there. Only places named by a published scheme are listed."
        className="sm:pb-8"
      />

      <Section className="pt-0">
        {cities.length === 0 ? (
          <Card className="mx-auto max-w-2xl items-center gap-2 p-10 text-center" data-testid="cities-empty">
            <p className="font-medium">No places to browse yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Cities appear here as graduate schemes are published with a location. Nothing is listed from guesswork.
            </p>
          </Card>
        ) : (
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4" data-testid="city-list">
            {cities.map((city, index) => (
              <FeatureCard
                key={city.slug}
                index={index}
                icon={MapPinned}
                title={city.name}
                description={`${city.count} scheme${city.count === 1 ? "" : "s"} based in ${city.name}`}
                href={`/graduate-schemes/cities/${city.slug}`}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
