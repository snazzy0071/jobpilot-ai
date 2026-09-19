import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { CtaSection } from "@/components/marketing/cta-section";
import { Section } from "@/components/marketing/section";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { Card } from "@/components/ui/card";
import { CategoryFilter } from "@/components/blog/category-filter";
import { PostCard } from "@/components/blog/post-card";
import { getBlogCategories, getBlogPosts } from "@/lib/blog/queries";
import { buildMetadata } from "@/lib/seo/metadata";

// Posts are DB-backed with no admin CMS yet, so this can't be statically
// generated at build time without risking a build failure if the blog
// migration hasn't been applied to a given environment — render per
// request instead.
export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Blog",
  description:
    "CV advice, ATS insights, interview preparation, and UK visa sponsorship guidance for job seekers.",
  path: "/blog",
});

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [categories, posts] = await Promise.all([
    getBlogCategories(),
    getBlogPosts({ categorySlug: category }),
  ]);

  return (
    <>
      <PageHero
        breadcrumbs={<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />}
        eyebrow="Blog"
        title={
          <>
            CV, interview, and <GradientText>visa advice</GradientText>
          </>
        }
        description="Practical guidance on CVs, applications, interviews, and UK visa sponsorship — written for the job search you're actually running."
        className="sm:pb-12"
      />

      <Section className="pt-0">
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          <CategoryFilter categories={categories} activeSlug={category} />

          {posts.length === 0 ? (
            <Card className="items-center gap-2 p-10 text-center">
              <p className="font-medium">No posts here yet</p>
              <p className="text-sm text-muted-foreground">
                Check back soon, or browse a different category.
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} index={index} />
              ))}
            </div>
          )}
        </div>
      </Section>

      <CtaSection title="Get new posts in your inbox" description="Occasional career tips and feature updates. No account needed.">
        <Button size="lg" variant="secondary" render={<Link href="/newsletter">Subscribe</Link>} />
      </CtaSection>
    </>
  );
}
