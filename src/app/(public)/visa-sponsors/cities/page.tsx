import { Building2 } from "lucide-react";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { FeatureCard } from "@/components/marketing/feature-card";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { SPONSOR_CITIES } from "@/config/sponsor-cities";
import { getSponsorCityCounts } from "@/lib/sponsors/queries";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "UK Visa Sponsors by City",
  description: "Browse licensed UK visa sponsors by city, including London, Manchester, Birmingham, and more.",
  path: "/visa-sponsors/cities",
});

export default async function SponsorCitiesPage() {
  const cityCounts = await getSponsorCityCounts(SPONSOR_CITIES);

  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="w-full self-start">
            <Breadcrumbs
              items={[{ label: "Home", href: "/" }, { label: "Visa Sponsors", href: "/visa-sponsors" }, { label: "Cities" }]}
            />
          </div>
          <Eyebrow>Browse by city</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            UK visa sponsors, by city
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Pick a city to see licensed sponsors based there.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cityCounts.map((city) => (
            <FeatureCard
              key={city.slug}
              icon={Building2}
              title={city.name}
              description={
                city.count > 0
                  ? `${city.count.toLocaleString()} sponsor${city.count === 1 ? "" : "s"} based in ${city.name}`
                  : `Sponsors based in ${city.name}`
              }
              href={`/visa-sponsors/cities/${city.slug}`}
            />
          ))}
        </div>
      </Section>
    </>
  );
}
