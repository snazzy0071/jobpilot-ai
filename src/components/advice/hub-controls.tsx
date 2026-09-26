import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ADVICE_CATEGORIES, ADVICE_CATEGORY_LABELS, type AdviceCategory } from "@/lib/advice/categories";
import { hubQuery, type HubParams } from "@/lib/advice/search";

const CHIP = "rounded-full border px-4 py-1.5 text-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** A plain GET form: works without JavaScript and gives every search a shareable URL. The active category is kept while searching. */
export function HubSearch({ params }: { params: HubParams }) {
  return (
    <form action="/advice-hub" method="get" role="search" aria-label="Search advice guides" className="flex flex-wrap items-end gap-3">
      {params.category && <input type="hidden" name="category" value={params.category} />}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Label htmlFor="advice-q">Search the guides</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="advice-q" name="q" defaultValue={params.q} maxLength={100} placeholder="e.g. STAR method, deadlines, keywords" className="pl-8" />
        </div>
      </div>
      <Button type="submit">Search</Button>
      {(params.q || params.category) && <Button variant="outline" render={<Link href="/advice-hub">Clear</Link>} />}
    </form>
  );
}

export function CategoryChips({ params, counts }: { params: HubParams; counts: Record<string, number> }) {
  const item = (category: AdviceCategory | null, label: string, count?: number) => {
    const active = params.category === category;
    return (
      <li key={category ?? "all"}>
        <Link
          href={`/advice-hub${hubQuery(params, { category, page: 1 }) ? `?${hubQuery(params, { category, page: 1 })}` : ""}`}
          className={cn(CHIP, active && "border-primary bg-primary/5 text-primary")}
          aria-current={active ? "true" : undefined}
          data-testid="category-chip"
        >
          {label}
          {count !== undefined && <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>}
        </Link>
      </li>
    );
  };
  return (
    <nav aria-label="Guide categories">
      <ul className="flex flex-wrap gap-2">
        {item(null, "All guides", Object.values(counts).reduce((sum, n) => sum + n, 0))}
        {ADVICE_CATEGORIES.map((category) => item(category, ADVICE_CATEGORY_LABELS[category], counts[category] ?? 0))}
      </ul>
    </nav>
  );
}
