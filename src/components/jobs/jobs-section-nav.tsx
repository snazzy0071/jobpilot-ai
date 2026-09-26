import Link from "next/link";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "feed", label: "Job feed", href: "/dashboard/jobs" },
  { key: "saved", label: "Saved jobs", href: "/dashboard/jobs/saved" },
] as const;

/** Two real pages, so real links (not tabs that swap client state): each is its own URL, works without JS, and the current one is marked for assistive tech. */
export function JobsSectionNav({ active }: { active: "feed" | "saved" }) {
  return (
    <nav aria-label="Jobs" className="flex gap-1 border-b">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            item.key === active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
