import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { CtaSection } from "@/components/marketing/cta-section";
import { ComparisonView, formatCheckedDate } from "@/components/comparisons/comparison-view";
import { getLiveComparisonBySlug } from "@/lib/comparisons/queries";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";
import type { ComparisonPage } from "@/lib/comparisons/types";

// Per request: an admin can publish, correct or withdraw a comparison at any time.
export const dynamic = "force-dynamic";

/** A description made only of what the page actually contains — no claims added for SEO. */
function describe(page: ComparisonPage): string {
  const parts = [`JobPilot AI compared with ${page.competitorName}`];
  const counts: string[] = [];
  if (page.features.length) counts.push(`${page.features.length} feature${page.features.length === 1 ? "" : "s"}`);
  if (page.pricing.length) counts.push("pricing notes");
  if (page.differences.length) counts.push("key differences");
  if (counts.length) parts.push(`covering ${counts.join(", ")}`);
  return `${parts.join(" ")}. Every claim about ${page.competitorName} is sourced; information checked ${formatCheckedDate(page.updatedOn)}.`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getLiveComparisonBySlug(slug);
  if (!page) return buildMetadata({ title: "Comparison not found", description: "This comparison couldn't be found.", path: `/compare/${slug}`, noIndex: true });
  const metadata = buildMetadata({ title: `JobPilot AI vs ${page.competitorName}`, description: describe(page), path: `/compare/${page.slug}` });
  return { ...metadata, openGraph: { ...metadata.openGraph, type: "article", modifiedTime: page.updatedOn } };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getLiveComparisonBySlug(slug);
  if (!page) notFound();

  // WebPage only — deliberately not Product/Review/AggregateRating: this is our own comparison, not a review, and that markup
  // would claim ratings we don't have. FAQPage is emitted by the FAQ component from the very questions shown.
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `JobPilot AI vs ${page.competitorName}`,
    url: `${siteConfig.domain}/compare/${page.slug}`,
    description: describe(page),
    dateModified: page.updatedOn,
    about: [
      { "@type": "SoftwareApplication", name: siteConfig.name, url: siteConfig.domain },
      { "@type": "SoftwareApplication", name: page.competitorName, ...(page.competitorWebsite ? { url: page.competitorWebsite } : {}) },
    ],
    publisher: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <>
      <PageHero
        breadcrumbs={<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Compare", href: "/compare" }, { label: `JobPilot AI vs ${page.competitorName}` }]} />}
        eyebrow="Compare"
        title={`JobPilot AI vs ${page.competitorName}`}
        description={`A sourced side-by-side of what each includes. Every statement about ${page.competitorName} links to where it came from.`}
        className="sm:pb-8"
      />

      <ComparisonView page={page} />

      <CtaSection title="Try JobPilot AI free" description="See how it works on your own CV and a real job description.">
        <Button size="lg" variant="secondary" render={<Link href="/signup">Get started free</Link>} />
      </CtaSection>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage).replace(/</g, "\\u003c") }} />
    </>
  );
}
