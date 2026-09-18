import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ArticleBody } from "@/components/content/article-body";
import { TableOfContents } from "@/components/content/table-of-contents";
import { PostCard } from "@/components/blog/post-card";
import { getBlogPostBySlug, getRelatedPosts } from "@/lib/blog/queries";
import { formatBlogDate, getInitials } from "@/lib/blog/format";
import { siteConfig } from "@/config/site";
import { buildArticleMetadata } from "@/lib/seo/metadata";

// Same reasoning as /blog: DB-backed with no admin CMS yet, so this stays
// server-rendered per request rather than statically generated.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) {
    return { title: "Post not found" };
  }

  return buildArticleMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    publishedTime: post.publishedAt,
    authors: [post.author.name],
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  const related = await getRelatedPosts(post);
  const url = `${siteConfig.domain}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    author: { "@type": "Person", name: post.author.name },
    publisher: { "@type": "Organization", name: siteConfig.name },
    mainEntityOfPage: url,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output going into a JSON-LD script tag, not
        // visible markup — escaping "<" still guards against a stray
        // "</script>" in the content prematurely closing the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="w-full self-start">
            <Breadcrumbs
              items={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.title }]}
            />
          </div>
          <Badge
            variant="secondary"
            render={<Link href={`/blog?category=${post.category.slug}`}>{post.category.name}</Link>}
          />
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{post.title}</h1>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <Avatar size="sm">
              <AvatarFallback>{getInitials(post.author.name)}</AvatarFallback>
            </Avatar>
            <span>{post.author.name}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingTimeMinutes} min read</span>
          </div>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[14rem_1fr]">
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <TableOfContents content={post.content} />
          </aside>
          <article>
            <ArticleBody content={post.content} />
            {post.author.bio && (
              <div className="mt-10 flex items-start gap-3 rounded-lg border p-4">
                <Avatar>
                  <AvatarFallback>{getInitials(post.author.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{post.author.name}</p>
                  <p className="text-sm text-muted-foreground">{post.author.bio}</p>
                </div>
              </div>
            )}
          </article>
        </div>
      </Section>

      {related.length > 0 && (
        <Section tone="muted">
          <SectionHeading eyebrow="Related" title="More like this" align="left" />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((relatedPost) => (
              <PostCard key={relatedPost.id} post={relatedPost} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
