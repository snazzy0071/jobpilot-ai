import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/marketing/container";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { Reveal } from "@/components/motion/reveal";
import { Eyebrow } from "@/components/marketing/eyebrow";

export type StatBandItem = {
  icon: LucideIcon;
  /** A real figure (counted up when it scrolls into view) or a short factual phrase. */
  value: number | string;
  suffix?: string;
  label: string;
  caption: string;
};

/**
 * A colourful proof band: big figures with a one-line source. Every item must be a real, checkable fact or a live number the caller
 * read from the database; never a placeholder or an invented metric.
 */
export function StatBand({ eyebrow, title, items }: { eyebrow: string; title: string; items: StatBandItem[] }) {
  return (
    <section className="section-mesh relative overflow-hidden py-20 sm:py-28" aria-labelledby="stat-band-title">
      <div className="bg-grid-light pointer-events-none absolute inset-0" aria-hidden="true" />
      <Container className="relative">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 id="stat-band-title" className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {title}
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <Reveal
              key={item.label}
              delay={Math.min(index * 0.08, 0.3)}
              className="glass group rounded-3xl p-6 shadow-elevated transition-all duration-300 hover:-translate-y-1.5 hover:shadow-floating"
            >
              <span className="gradient-brand flex size-11 items-center justify-center rounded-2xl text-white shadow-[0_8px_20px_-6px_rgba(51,80,255,0.6)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              <p className="text-gradient mt-5 font-heading text-5xl font-bold tracking-tight tabular-nums">
                {typeof item.value === "number" ? <AnimatedCounter value={item.value} suffix={item.suffix} /> : item.value}
              </p>
              <p className="mt-2 font-semibold">{item.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.caption}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
