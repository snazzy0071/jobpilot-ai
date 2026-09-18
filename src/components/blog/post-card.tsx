import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatBlogDate } from "@/lib/blog/format";
import type { BlogPostSummary } from "@/lib/blog/types";

export function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/30">
        <CardHeader className="gap-3">
          <Badge variant="secondary" className="w-fit">
            {post.category.name}
          </Badge>
          <CardTitle className="text-lg">{post.title}</CardTitle>
          <CardDescription>{post.excerpt}</CardDescription>
          <p className="text-xs text-muted-foreground">
            {post.author.name} · <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>{" "}
            · {post.readingTimeMinutes} min read
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}
