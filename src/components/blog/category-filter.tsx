import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BlogCategory } from "@/lib/blog/types";

export function CategoryFilter({
  categories,
  activeSlug,
}: {
  categories: BlogCategory[];
  activeSlug?: string;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      <Link
        href="/blog"
        className={cn(
          "rounded-full border px-4 py-1.5 text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          !activeSlug && "border-primary bg-primary/5 text-primary",
        )}
      >
        All posts
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/blog?category=${category.slug}`}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            activeSlug === category.slug && "border-primary bg-primary/5 text-primary",
          )}
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}
