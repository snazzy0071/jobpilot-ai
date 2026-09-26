import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/marketing/container";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { Reveal } from "@/components/motion/reveal";

export type StatBandItem = {
  icon: LucideIcon;
  /** A real figure (counted up when it scrolls into view) or a short factual phrase. */
  value: number | string;
  suffix?: string;
  label: string;
  caption: string;
};

/**
 * A dark proof band: big figures with a one-line source. Every item must be a real, checkable fact or a live number the caller
 * read from the database; never a placeholder or an invented metric.
 */
export function StatBand({ eyebrow, title, items }: { eyebrow: string; title: string; items: StatBandItem[] }) {
  return (
    <section className="section-dark relative overflow-hidden py-16 sm:py-20" aria-labelledby="stat-band-title">
      <div className="bg-grid-fade pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <Container className="relative">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">{eyebrow}</p>
          <h2 id="stat-band-title" className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <Reveal
              key={item.label}
              delay={Math.min(index * 0.08, 0.3)}
              className="rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.1]"
            >
              <item.icon className="size-5 text-white/70" aria-hidden="true" />
              <p className="mt-3 font-heading text-4xl font-semibold tracking-tight tabular-nums">
                {typeof item.value === "number" ? <AnimatedCounter value={item.value} suffix={item.suffix} /> : item.value}
              </p>
              <p className="mt-1 text-sm font-medium">{item.label}</p>
              <p className="mt-0.5 text-xs text-white/70">{item.caption}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
