import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { Section } from "@/components/marketing/section";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { SchemeCard } from "@/components/graduate-schemes/scheme-parts";
import { getGraduateSchemes } from "@/lib/graduate-schemes/queries";
import { findCity, schemesForCity } from "@/lib/graduate-schemes/cities";
import { sortSchemes } from "@/lib/graduate-schemes/filter";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const city = findCity(await getGraduateSchemes(), slug);
  if (!city) return { title: "City not found", robots: { index: false, follow: false } };
  return buildMetadata({
    title: `Graduate Schemes in ${city.name}`,
    description: `${city.count} UK graduate scheme${city.count === 1 ? "" : "s"} based in ${city.name}, with deadlines, sponsorship status and the source behind each entry.`,
    path: `/graduate-schemes/cities/${city.slug}`,
  });
}

export default async function GraduateSchemeCityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const all = await getGraduateSchemes();
  const city = findCity(all, slug);
  if (!city) notFound();
  const schemes = sortSchemes(schemesForCity(all, slug), "deadline");

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Graduate schemes in ${city.name}`,
    numberOfItems: schemes.length,
    itemListElement: schemes.map((scheme, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteConfig.domain}/graduate-schemes/${scheme.slug}`,
      name: `${scheme.schemeName} — ${scheme.employer}`,
    })),
  };

  return (
    <>
      <PageHero
        breadcrumbs={
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Graduate schemes", href: "/graduate-schemes" }, { label: "Cities", href: "/graduate-schemes/cities" }, { label: city.name }]}
          />
        }
        eyebrow="Graduate schemes"
        title={
          <>
            Graduate schemes in <GradientText>{city.name}</GradientText>
          </>
        }
        description={`${schemes.length} published scheme${schemes.length === 1 ? "" : "s"} that name ${city.name} as a location. Confirm dates on the employer's own page before applying.`}
        className="sm:pb-8"
      />

      <Section className="pt-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="flex flex-col gap-3" data-testid="scheme-list">
            {schemes.map((scheme) => (
              <SchemeCard key={scheme.id} scheme={scheme} />
            ))}
          </div>
          <Button variant="outline" className="self-start" render={<Link href="/graduate-schemes/cities">All cities</Link>} />
        </div>
      </Section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\u003c") }} />
    </>
  );
}
