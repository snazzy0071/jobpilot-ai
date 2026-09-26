import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { Section } from "@/components/marketing/section";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { SponsorPagination } from "@/components/marketing/sponsor-pagination";
import { GuideCard } from "@/components/advice/guide-card";
import { CategoryChips, HubSearch } from "@/components/advice/hub-controls";
import { ADVICE_CATEGORY_DESCRIPTIONS, ADVICE_CATEGORY_LABELS, isAdviceCategory } from "@/lib/advice/categories";
import { categoryCounts, featuredGuides, filterByCategory, hubQuery, paginate, parseHubParams, searchGuides } from "@/lib/advice/search";
import { getLiveGuides } from "@/lib/advice/queries";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

// Read per request: guides can be published, scheduled or withdrawn at any time.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = parseHubParams(await searchParams, isAdviceCategory);
  const metadata = buildMetadata({
    title: "Advice Hub",
    description: "Practical, plain-English guides on CVs, ATS, interviews, applications, graduate schemes, visa sponsorship and assessments for the UK job market.",
    path: "/advice-hub",
  });
  // Searches, category views and later pages are the same content at other URLs: out of the index, links still followed.
  return params.q || params.category || params.page > 1 ? { ...metadata, robots: { index: false, follow: true } } : metadata;
}

export default async function AdviceHubPage({ searchParams }: { searchParams: SearchParams }) {
  const params = parseHubParams(await searchParams, isAdviceCategory);
  const live = await getLiveGuides();
  const counts = categoryCounts(live);

  const matching = filterByCategory(searchGuides(live, params.q), params.category);
  const { items, page, totalPages } = paginate(matching, params.page);
  const featured = !params.q && !params.category && page === 1 ? featuredGuides(live) : [];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Advice Hub guides",
    numberOfItems: matching.length,
    itemListElement: items.map((guide, index) => ({ "@type": "ListItem", position: index + 1, url: `${siteConfig.domain}/advice-hub/${guide.slug}`, name: guide.title })),
  };

  return (
    <>
      <PageHero
        breadcrumbs={<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Advice Hub" }]} />}
        eyebrow="Advice Hub"
        title={
          <>
            Practical guides for <GradientText>your UK job search</GradientText>
          </>
        }
        description="Plain-English guides on CVs, ATS, interviews, applications, graduate schemes, visa sponsorship and assessments — written to be used, not just read."
        className="sm:pb-8"
      />

      <Section className="pt-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <HubSearch params={params} />
          <CategoryChips params={params} counts={counts} />

          {params.category && (
            <div>
              <h2 className="font-heading text-xl font-semibold" data-testid="category-heading">
                {ADVICE_CATEGORY_LABELS[params.category]}
              </h2>
              <p className="text-sm text-muted-foreground">{ADVICE_CATEGORY_DESCRIPTIONS[params.category]}</p>
            </div>
          )}

          {live.length === 0 ? (
            <Card className="items-center gap-2 p-10 text-center" data-testid="hub-empty">
              <p className="font-medium">No guides have been published yet</p>
              <p className="text-sm text-muted-foreground">Check back soon.</p>
            </Card>
          ) : (
            <>
              {featured.length > 0 && (
                <section aria-labelledby="featured-heading" data-testid="featured">
                  <h2 id="featured-heading" className="mb-4 font-heading text-xl font-semibold">
                    Featured guides
                  </h2>
                  <div className="grid gap-4 md:grid-cols-3">
                    {featured.map((guide) => (
                      <GuideCard key={guide.id} guide={guide} featured />
                    ))}
                  </div>
                </section>
              )}

              <section aria-labelledby="all-heading">
                <h2 id="all-heading" className="mb-1 font-heading text-xl font-semibold">
                  {params.q ? "Search results" : params.category ? "All guides in this category" : "All guides"}
                </h2>
                <p className="mb-4 text-sm text-muted-foreground" role="status" data-testid="result-count">
                  {matching.length} guide{matching.length === 1 ? "" : "s"}
                  {params.q ? ` matching “${params.q}”` : ""}
                  {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
                </p>
                {matching.length === 0 ? (
                  <Card className="items-center gap-3 p-10 text-center" data-testid="hub-no-results">
                    <p className="font-medium">No guides match that search</p>
                    <p className="text-sm text-muted-foreground">Try fewer or different words, or browse a category.</p>
                    <Button variant="outline" render={<Link href="/advice-hub">Clear search</Link>} />
                  </Card>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="guide-list">
                      {items.map((guide) => (
                        <GuideCard key={guide.id} guide={guide} />
                      ))}
                    </div>
                    <div className="mt-6">
                      <SponsorPagination basePath="/advice-hub" currentPage={page} totalPages={totalPages} searchParams={Object.fromEntries(new URLSearchParams(hubQuery(params, { page: 1 })).entries())} />
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Guides are general information, not legal or immigration advice, and rules and dates change — check the employer&apos;s or the government&apos;s own page before relying on anything. Looking for news and opinion?{" "}
            <Link href="/blog" className="underline">
              Read the blog
            </Link>
            .
          </p>
        </div>
      </Section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }} />
    </>
  );
}
