import type { LucideIcon } from "lucide-react";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { StaggerItem } from "@/components/motion/stagger-item";
import { cn } from "@/lib/utils";

export type StatItem = {
  icon: LucideIcon;
  /** A real, checkable claim or a live figure (may include an AnimatedCounter). */
  title: React.ReactNode;
  caption: string;
};

/** A row of icon + claim + caption tiles. Real facts only, never invented metrics. */
export function StatStrip({ items, className }: { items: StatItem[]; className?: string }) {
  return (
    <StaggerContainer
      className={cn("grid gap-3 sm:grid-cols-2", items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4", className)}
    >
      {items.map((item) => (
        <StaggerItem
          key={item.caption}
          className="group flex items-start gap-3 rounded-2xl border bg-card/70 p-4 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <item.icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.caption}</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
