import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ADVICE_CATEGORY_LABELS } from "@/lib/advice/categories";
import type { AdviceGuide } from "@/lib/advice/types";

export function formatGuideDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

/** One guide in a list. The whole card is a link (the title is the accessible name); `featured` gives it more presence. */
export function GuideCard({ guide, featured = false }: { guide: AdviceGuide; featured?: boolean }) {
  return (
    <Link href={`/advice-hub/${guide.slug}`} className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" data-testid={featured ? "featured-card" : "guide-card"}>
      <Card className={`h-full gap-3 p-5 transition-colors group-hover:bg-muted/40 ${featured ? "border-primary/30" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" data-testid="guide-category">
            {ADVICE_CATEGORY_LABELS[guide.category]}
          </Badge>
          {featured && <Badge variant="tinted">Featured</Badge>}
        </div>
        <h3 className="text-lg font-semibold tracking-tight" data-testid="guide-title">
          {guide.title}
        </h3>
        <p className="text-sm text-muted-foreground">{guide.summary}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {guide.publishedAt ? <time dateTime={guide.publishedAt}>{formatGuideDate(guide.publishedAt)}</time> : "Draft"} · {guide.readingTimeMinutes} min read
          </p>
          <ArrowRightIcon className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </div>
      </Card>
    </Link>
  );
}
