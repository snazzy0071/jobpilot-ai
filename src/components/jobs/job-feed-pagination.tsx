import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function buildHref(searchParams: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard/jobs?${query}` : "/dashboard/jobs";
}

/** Same real, no-JS-required `<Link>`-based pager as src/components/marketing/sponsor-pagination.tsx, adapted for the job feed's own query params. */
export function JobFeedPagination({
  currentPage,
  totalPages,
  searchParams,
}: {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const windowStart = Math.max(1, currentPage - 2);
  const windowEnd = Math.min(totalPages, currentPage + 2);
  const pages = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {currentPage > 1 ? (
        <Button variant="outline" size="icon-sm" aria-label="Previous page" render={<Link href={buildHref(searchParams, currentPage - 1)} />}>
          <ChevronLeft />
        </Button>
      ) : (
        <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled>
          <ChevronLeft />
        </Button>
      )}

      {pages.map((page) =>
        page === currentPage ? (
          <Button key={page} variant="default" size="icon-sm" aria-current="page" disabled>
            {page}
          </Button>
        ) : (
          <Button key={page} variant="outline" size="icon-sm" render={<Link href={buildHref(searchParams, page)} />}>
            {page}
          </Button>
        ),
      )}

      {currentPage < totalPages ? (
        <Button variant="outline" size="icon-sm" aria-label="Next page" render={<Link href={buildHref(searchParams, currentPage + 1)} />}>
          <ChevronRight />
        </Button>
      ) : (
        <Button variant="outline" size="icon-sm" aria-label="Next page" disabled>
          <ChevronRight />
        </Button>
      )}
    </nav>
  );
}
