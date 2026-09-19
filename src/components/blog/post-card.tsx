import Link from "next/link";
import { ArrowRightIcon, BookOpenIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import { formatBlogDate } from "@/lib/blog/format";
import type { BlogPostSummary } from "@/lib/blog/types";

const COVERS = [
  "from-primary/25 via-primary/10 to-brand-secondary/20",
  "from-brand-secondary/25 via-primary/10 to-primary/20",
  "from-primary/20 via-brand-accent/20 to-brand-secondary/15",
  "from-success/20 via-primary/10 to-primary/25",
];

// A stable cover per post (the same slug always gets the same one), so
// a card doesn't change colour between renders.
function coverFor(slug: string) {
  let sum = 0;
  for (const char of slug) sum += char.charCodeAt(0);
  return COVERS[sum % COVERS.length];
}

export function PostCard({ post, index = 0 }: { post: BlogPostSummary; index?: number }) {
  return (
    <Reveal className="h-full" delay={Math.min(index * 0.06, 0.3)}>
      <Link
        href={`/blog/${post.slug}`}
        className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card variant="tool" className="h-full gap-0 p-0">
          <div className={`relative flex h-32 items-center justify-center overflow-hidden border-b bg-gradient-to-br ${coverFor(post.slug)}`}>
            <div className="bg-grid-fade absolute inset-0 opacity-70" aria-hidden="true" />
            <span className="relative flex size-12 items-center justify-center rounded-2xl bg-card/80 text-primary shadow-elevated backdrop-blur-sm transition-transform duration-500 group-hover/card:scale-110 group-hover/card:-rotate-3">
              <BookOpenIcon className="size-6" />
            </span>
          </div>
          <CardHeader className="gap-3 pt-5">
            <Badge variant="secondary" className="w-fit">
              {post.category.name}
            </Badge>
            <CardTitle className="text-lg">{post.title}</CardTitle>
            <CardDescription>{post.excerpt}</CardDescription>
            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                {post.author.name} · <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time> ·{" "}
                {post.readingTimeMinutes} min read
              </p>
              <ArrowRightIcon className="size-4 shrink-0 text-primary transition-transform duration-300 group-hover/card:translate-x-1" aria-hidden="true" />
            </div>
          </CardHeader>
        </Card>
      </Link>
    </Reveal>
  );
}
