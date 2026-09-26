import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { Section } from "@/components/marketing/section";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { CtaSection } from "@/components/marketing/cta-section";
import { SponsorPagination } from "@/components/marketing/sponsor-pagination";
import { SchemeCard } from "@/components/graduate-schemes/scheme-parts";
import { SchemeFiltersForm } from "@/components/graduate-schemes/scheme-filters";
import { getGraduateSchemes } from "@/lib/graduate-schemes/queries";
import { filterSchemes, hasActiveFilters, paginate, parseSchemeFilters, schemeFiltersToQuery, sortSchemes } from "@/lib/graduate-schemes/filter";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

// Read per request: the schemes are database rows an admin can change at any time, and "open / closed" depends on today's date.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseSchemeFilters(await searchParams);
  const filtered = hasActiveFilters(filters) || filters.page > 1 || filters.sort !== "deadline";
  const metadata = buildMetadata({
    title: "UK Graduate Schemes",
    description: "Search UK graduate schemes by sector, study stage, location and deadline, with visa sponsorship status, assessments and the source behind every entry.",
    path: "/graduate-schemes",
    // Every filtered or paged view is a different URL for the same content; keep them out of the index and canonical to the main list.
  });
  // Filtered and paged views stay out of the index but their links are still followed, so every scheme is reachable.
  return filtered ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function GraduateSchemesPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams;
  const filters = parseSchemeFilters(raw);
  const all = await getGraduateSchemes();

  const matching = sortSchemes(filterSchemes(all, filters), filters.sort);
  const { items, page, totalPages } = paginate(matching, filters.page);
  const locations = [...new Set(all.flatMap((scheme) => scheme.locations))].sort((a, b) => a.localeCompare(b));
  const paramsForLinks = Object.fromEntries(new URLSearchParams(schemeFiltersToQuery(filters, { page: 1 })).entries());

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "UK graduate schemes",
    numberOfItems: matching.length,
    itemListElement: items.map((scheme, index) => ({
      "@type": "ListItem",
      position: (page - 1) * 12 + index + 1,
      url: `${siteConfig.domain}/graduate-schemes/${scheme.slug}`,
      name: `${scheme.schemeName} — ${scheme.employer}`,
    })),
  };

  return (
    <>
      <PageHero
        breadcrumbs={<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Graduate schemes" }]} />}
        eyebrow="Graduate schemes"
        title={
          <>
            Find a UK graduate scheme <GradientText>you can apply for</GradientText>
          </>
        }
        description="Deadlines, who each scheme is for, how you are assessed and whether the employer sponsors visas — every entry with the source it was checked against and the date it was last verified."
        className="sm:pb-8"
      />

      <Section className="pt-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <SchemeFiltersForm filters={filters} locations={locations} />

          {all.length > 0 && (
            <p className="text-sm text-muted-foreground" role="status" data-testid="result-count">
              {matching.length} scheme{matching.length === 1 ? "" : "s"} {hasActiveFilters(filters) ? "match your filters" : "listed"}
              {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
            </p>
          )}

          {all.length === 0 ? (
            <Card className="items-center gap-2 p-10 text-center" data-testid="schemes-empty">
              <p className="font-medium">No graduate schemes have been published yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                We only list a scheme once it has been checked against the employer&apos;s own information, so this list grows as schemes are verified — nothing here is filled in from guesswork.
              </p>
            </Card>
          ) : matching.length === 0 ? (
            <Card className="items-center gap-3 p-10 text-center" data-testid="schemes-no-match">
              <p className="font-medium">No schemes match those filters</p>
              <p className="text-sm text-muted-foreground">Try removing a filter or searching for something broader.</p>
              <Button variant="outline" render={<Link href="/graduate-schemes">Clear filters</Link>} />
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-3" data-testid="scheme-list">
                {items.map((scheme) => (
                  <SchemeCard key={scheme.id} scheme={scheme} />
                ))}
              </div>
              <SponsorPagination basePath="/graduate-schemes" currentPage={page} totalPages={totalPages} searchParams={paramsForLinks} />
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Dates and sponsorship are as published by each employer on the date shown and can change — always confirm on the employer&apos;s own page before applying. This is not immigration advice; to check a
            specific employer&apos;s licence use the <Link href="/visa-sponsors" className="underline">sponsor register</Link>.
          </p>
        </div>
      </Section>

      <CtaSection title="Prepare for the application itself" description="Practise the aptitude tests and interviews these schemes use.">
        <Button size="lg" variant="secondary" render={<Link href="/features/gradprep">Grad Scheme Prep</Link>} />
      </CtaSection>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }} />
    </>
  );
}
