import type { LucideIcon } from "lucide-react";
import { FloatingElement } from "@/components/motion/floating-element";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

export type StackItem = {
  icon: LucideIcon;
  title: string;
  caption?: string;
  tone?: "primary" | "coral" | "success" | "accent";
};

const TONES = {
  primary: "bg-primary/10 text-primary",
  coral: "bg-brand-secondary/10 text-brand-secondary",
  success: "bg-success/10 text-success",
  accent: "bg-brand-accent/20 text-foreground",
} as const;

// Staggered offsets so up to four cards read as a loose, overlapping
// collage rather than a rigid list.
const SLOTS = [
  "sm:translate-x-0 sm:-rotate-1",
  "sm:translate-x-10 sm:rotate-1",
  "sm:translate-x-3 sm:-rotate-1",
  "sm:translate-x-12 sm:rotate-1",
];

/**
 * A hero visual for pages without a product screen of their own: a
 * loose stack of small, gently floating chip cards (icon tile + title
 * + caption) over a soft brand glow. Every card says something true
 * about the page; nothing here is a stat or a screenshot.
 */
export function FloatingCardStack({ items, className }: { items: StackItem[]; className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-md", className)}>
      <div
        className="pointer-events-none absolute -inset-3 -z-10 sm:-inset-6 rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-brand-secondary/15 blur-2xl"
        aria-hidden="true"
      />
      <div className="flex flex-col gap-4">
        {items.slice(0, 4).map((item, index) => (
          <Reveal key={item.title} delay={0.15 + index * 0.12} className={SLOTS[index]}>
            <FloatingElement delay={index * 1.2}>
              <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-elevated transition-shadow hover:shadow-floating">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    TONES[item.tone ?? "primary"],
                  )}
                >
                  <item.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.caption && <p className="text-xs text-muted-foreground">{item.caption}</p>}
                </div>
              </div>
            </FloatingElement>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
