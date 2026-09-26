import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { Section } from "@/components/marketing/section";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { CtaSection } from "@/components/marketing/cta-section";
import { SponsorPagination } from "@/components/marketing/sponsor-pagination";
import { DeadlineRow } from "@/components/graduate-schemes/deadline-row";
import { SchemeFiltersForm } from "@/components/graduate-schemes/scheme-filters";
import { getGraduateSchemes } from "@/lib/graduate-schemes/queries";
import { filterSchemes, hasActiveFilters, paginate, parseSchemeFilters, schemeFiltersToQuery, sortSchemes, type SchemeSort } from "@/lib/graduate-schemes/filter";
import { CLOSING_SOON_DAYS, DEADLINE_GROUP_LABELS, DEADLINE_GROUP_ORDER, deadlineGroup } from "@/lib/graduate-schemes/status";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

// Read per request: "closing soon" and "closed" depend on today's date, and admins can change dates at any time.
export const dynamic = "force-dynamic";

const SORTS: readonly SchemeSort[] = ["deadline", "opens", "employer", "newest"];
const PAGE_SIZE = 20;
const GROUP_CAP = 40;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseSchemeFilters(await searchParams);
  const filtered = hasActiveFilters(filters) || filters.page > 1 || filters.sort !== "deadline";
  const metadata = buildMetadata({
    title: "Graduate Scheme Application Deadlines",
    description: "Opening and closing dates for UK graduate schemes: what's closing soon, what's open, rolling schemes and those with no published deadline — each with its source and the date it was checked.",
    path: "/deadlines",
  });
  return filtered ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function DeadlinesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseSchemeFilters(await searchParams);
  const all = await getGraduateSchemes();
  const sort: SchemeSort = SORTS.includes(filters.sort) ? filters.sort : "deadline";
  const matching = sortSchemes(filterSchemes(all, { ...filters, sort }), sort);
  const grouped = sort === "deadline" && !filters.status;
  const locations = [...new Set(all.flatMap((scheme) => scheme.locations))].sort((a, b) => a.localeCompare(b));

  const flat = paginate(matching, filters.page, PAGE_SIZE);
  const groups = DEADLINE_GROUP_ORDER.map((group) => ({ group, items: matching.filter((scheme) => deadlineGroup(scheme) === group) })).filter((entry) => entry.items.length > 0);
  const shown = grouped ? groups.flatMap((entry) => entry.items.slice(0, GROUP_CAP)) : flat.items;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "UK graduate scheme application deadlines",
    numberOfItems: matching.length,
    itemListElement: shown.map((scheme, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteConfig.domain}/graduate-schemes/${scheme.slug}`,
      name: `${scheme.schemeName} — ${scheme.employer}`,
    })),
  };

  return (
    <>
      <PageHero
        breadcrumbs={<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Application deadlines" }]} />}
        eyebrow="Deadlines"
        title={
          <>
            Graduate scheme <GradientText>application deadlines</GradientText>
          </>
        }
        description={`When each scheme opens and closes, what's closing within ${CLOSING_SOON_DAYS} days, which are rolling, and which employers haven't published a deadline — every date with its source and the day it was last checked.`}
        className="sm:pb-8"
      />

      <Section className="pt-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <SchemeFiltersForm filters={filters} locations={locations} action="/deadlines" label="Search deadlines" extended={false} sorts={SORTS} />

          {all.length > 0 && (
            <p className="text-sm text-muted-foreground" role="status" data-testid="result-count">
              {matching.length} scheme{matching.length === 1 ? "" : "s"} {hasActiveFilters(filters) ? "match your filters" : "listed"}
              {!grouped && flat.totalPages > 1 ? ` · page ${flat.page} of ${flat.totalPages}` : ""}
            </p>
          )}

          {all.length === 0 ? (
            <Card className="items-center gap-2 p-10 text-center" data-testid="deadlines-empty">
              <p className="font-medium">No deadlines to show yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Dates are listed only for graduate schemes that have been checked against the employer&apos;s own information. As schemes are verified they appear here — nothing is estimated.
              </p>
              <Button variant="outline" render={<Link href="/graduate-schemes">Browse graduate schemes</Link>} />
            </Card>
          ) : matching.length === 0 ? (
            <Card className="items-center gap-3 p-10 text-center" data-testid="deadlines-no-match">
              <p className="font-medium">No schemes match those filters</p>
              <Button variant="outline" render={<Link href="/deadlines">Clear filters</Link>} />
            </Card>
          ) : grouped ? (
            <div className="flex flex-col gap-8">
              {groups.map(({ group, items }) => (
                <section key={group} aria-labelledby={`group-${group}`} data-testid={`group-${group}`}>
                  <h2 id={`group-${group}`} className="mb-3 font-heading text-lg font-semibold">
                    {DEADLINE_GROUP_LABELS[group]} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {items.slice(0, GROUP_CAP).map((scheme) => (
                      <DeadlineRow key={scheme.id} scheme={scheme} />
                    ))}
                  </ul>
                  {items.length > GROUP_CAP && <p className="mt-2 text-xs text-muted-foreground">Showing the first {GROUP_CAP} — use the filters to narrow the list.</p>}
                </section>
              ))}
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-3" data-testid="deadline-list">
                {flat.items.map((scheme) => (
                  <DeadlineRow key={scheme.id} scheme={scheme} />
                ))}
              </ul>
              <SponsorPagination basePath="/deadlines" currentPage={flat.page} totalPages={flat.totalPages} searchParams={Object.fromEntries(new URLSearchParams(schemeFiltersToQuery(filters, { page: 1 })).entries())} />
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Dates are as published by each employer on the date shown and can change — always confirm on the employer&apos;s own page before applying. Deadlines are UK dates. Not immigration advice; to check a
            specific employer&apos;s licence use the{" "}
            <Link href="/visa-sponsors" className="underline">
              sponsor register
            </Link>
            .
          </p>
        </div>
      </Section>

      <CtaSection title="Don't miss a closing date" description="Track every application, deadline and reminder in one place.">
        <Button size="lg" variant="secondary" render={<Link href="/features/tracker">Job Tracker</Link>} />
      </CtaSection>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }} />
    </>
  );
}
