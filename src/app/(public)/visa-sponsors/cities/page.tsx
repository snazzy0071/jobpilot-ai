import { Building2, MapPinned, RefreshCw } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { StatStrip } from "@/components/marketing/stat-strip";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { Section } from "@/components/marketing/section";
import { FeatureCard } from "@/components/marketing/feature-card";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { SPONSOR_CITIES } from "@/config/sponsor-cities";
import { getSponsorCityCounts } from "@/lib/sponsors/queries";
import { buildMetadata } from "@/lib/seo/metadata";

// getSponsorCityCounts() reads through createPublicClient() (no cookies), so this can be ISR instead of fully
// dynamic — the register syncs on its own periodic schedule, not sub-request freshness.
export const revalidate = 3600;

export const metadata = buildMetadata({
  title: "UK Visa Sponsors by City",
  description: "Browse licensed UK visa sponsors by city, including London, Manchester, Birmingham, and more.",
  path: "/visa-sponsors/cities",
});

export default async function SponsorCitiesPage() {
  const cityCounts = await getSponsorCityCounts(SPONSOR_CITIES);
  const totalInCities = cityCounts.reduce((sum, city) => sum + city.count, 0);

  return (
    <>
      <PageHero
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Visa Sponsors", href: "/visa-sponsors" }, { label: "Cities" }]}
          />
        }
        eyebrow="Browse by city"
        title={
          <>
            UK visa sponsors, <GradientText>by city</GradientText>
          </>
        }
        description="Pick a city to see licensed sponsors based there."
        footer={
          <div className="mx-auto max-w-3xl">
            <StatStrip
              items={[
                { icon: MapPinned, title: <AnimatedCounter value={cityCounts.length} />, caption: "Cities covered" },
                ...(totalInCities > 0
                  ? [{ icon: Building2, title: <AnimatedCounter value={totalInCities} />, caption: "Sponsors across them" }]
                  : []),
                { icon: RefreshCw, title: "Synced from gov.uk", caption: "Home Office public register" },
              ]}
            />
          </div>
        }
      />

      <Section className="pt-0">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cityCounts.map((city, index) => (
            <FeatureCard
              key={city.slug}
              index={index}
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
