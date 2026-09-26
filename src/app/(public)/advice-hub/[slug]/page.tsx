import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { PageHero } from "@/components/marketing/page-hero";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ArticleBody } from "@/components/content/article-body";
import { TableOfContents } from "@/components/content/table-of-contents";
import { GuideCard, formatGuideDate } from "@/components/advice/guide-card";
import { ADVICE_CATEGORY_LABELS, ADVICE_CATEGORY_TOOLS } from "@/lib/advice/categories";
import { getLiveGuideBySlug, getLiveGuides } from "@/lib/advice/queries";
import { relatedGuides } from "@/lib/advice/search";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getLiveGuideBySlug(slug);
  if (!guide) return buildMetadata({ title: "Guide not found", description: "This guide couldn't be found.", path: `/advice-hub/${slug}`, noIndex: true });
  const metadata = buildMetadata({ title: guide.title, description: guide.summary, path: `/advice-hub/${guide.slug}` });
  return { ...metadata, openGraph: { ...metadata.openGraph, type: "article", publishedTime: guide.publishedAt ?? undefined, modifiedTime: guide.updatedAt } };
}

export default async function AdviceGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getLiveGuideBySlug(slug);
  if (!guide) notFound();

  const related = relatedGuides(guide, await getLiveGuides());
  const tool = ADVICE_CATEGORY_TOOLS[guide.category];
  const hasHeadings = guide.content.some((block) => block.type === "heading");

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.summary,
    datePublished: guide.publishedAt,
    dateModified: guide.reviewedOn ?? guide.updatedAt,
    articleSection: ADVICE_CATEGORY_LABELS[guide.category],
    author: guide.authorName ? { "@type": "Person", name: guide.authorName } : { "@type": "Organization", name: siteConfig.name },
    publisher: { "@type": "Organization", name: siteConfig.name },
    mainEntityOfPage: `${siteConfig.domain}/advice-hub/${guide.slug}`,
  };

  return (
    <>
      <PageHero
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Advice Hub", href: "/advice-hub" },
              { label: ADVICE_CATEGORY_LABELS[guide.category], href: `/advice-hub?category=${guide.category}` },
              { label: guide.title },
            ]}
          />
        }
        badge={<Badge variant="secondary" render={<Link href={`/advice-hub?category=${guide.category}`}>{ADVICE_CATEGORY_LABELS[guide.category]}</Link>} />}
        title={guide.title}
        description={
          <span className="flex flex-col items-center gap-2">
            <span>{guide.summary}</span>
            <span className="flex flex-wrap items-center justify-center gap-2 text-sm">
              {guide.authorName && <span data-testid="guide-author">{guide.authorName}</span>}
              {guide.authorName && <span aria-hidden="true">·</span>}
              {guide.publishedAt && <time dateTime={guide.publishedAt}>{formatGuideDate(guide.publishedAt)}</time>}
              <span aria-hidden="true">·</span>
              <span data-testid="reading-time">{guide.readingTimeMinutes} min read</span>
              {guide.reviewedOn && (
                <>
                  <span aria-hidden="true">·</span>
                  <span data-testid="reviewed">Last reviewed {formatGuideDate(`${guide.reviewedOn}T12:00:00Z`)}</span>
                </>
              )}
            </span>
          </span>
        }
        className="sm:pb-12 [&_h1]:text-3xl [&_h1]:sm:text-4xl [&_h1]:lg:text-5xl"
      />

      <Section className="pt-0">
        <div className={hasHeadings ? "mx-auto grid max-w-4xl gap-10 lg:grid-cols-[14rem_1fr]" : "mx-auto max-w-3xl"}>
          {hasHeadings && (
            <aside className="lg:sticky lg:top-24 lg:h-fit" data-testid="toc">
              <TableOfContents content={guide.content} />
            </aside>
          )}
          <article data-testid="article">
            <ArticleBody content={guide.content} />

            <Card className="mt-10 gap-2 p-5" data-testid="next-step">
              <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Put it into practice</p>
              <p className="font-medium">{tool.label}</p>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
              <Button className="w-fit" render={<Link href={tool.href}>Open {tool.label}</Link>} />
            </Card>

            <p className="mt-6 text-xs text-muted-foreground">General information, not legal or immigration advice. Rules and dates change — confirm with the employer or the official source before you act.</p>
          </article>
        </div>
      </Section>

      {related.length > 0 && (
        <Section tone="muted" className="py-10">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-4 font-heading text-xl font-semibold">Related guides</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="related">
              {related.map((other) => (
                <GuideCard key={other.id} guide={other} />
              ))}
            </div>
          </div>
        </Section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
