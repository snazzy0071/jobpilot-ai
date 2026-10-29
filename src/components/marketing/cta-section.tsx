import { CheckIcon } from "lucide-react";
import { Container } from "@/components/marketing/container";
import { FloatingElement } from "@/components/motion/floating-element";
import { Reveal } from "@/components/motion/reveal";

// Renders as a big rounded brand-gradient card: pass buttons with a variant
// that contrasts against it (e.g. Button variant="secondary"), not the
// default variant, which is the same color as this background.
//
// Decoration is CSS-only and aria-hidden: a slow-panning coral/white wash,
// two drifting colour orbs, two concentric rings and a faint grid, all
// clipped to the section. `points` are short reassurance lines shown under
// the buttons (real facts only, e.g. "No card required").
export function CtaSection({
  title,
  description,
  points,
  children,
}: {
  title: string;
  description?: string;
  points?: string[];
  children: React.ReactNode;
}) {
  return (
    <section className="relative px-4 py-20 sm:px-8 sm:py-28">
      <div className="gradient-brand relative mx-auto max-w-[1240px] overflow-hidden rounded-[2rem] py-16 text-primary-foreground shadow-floating sm:rounded-[2.5rem] sm:py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="bg-grid-fade absolute inset-0 opacity-40 invert" />
        <div className="animate-blob absolute -top-24 -left-16 size-80 bg-brand-cyan/50 blur-3xl" />
        <div className="animate-blob absolute -right-10 -bottom-24 size-96 bg-white/25 blur-3xl [animation-delay:-7s]" />
        <div className="animate-blob absolute top-10 right-[30%] size-56 bg-brand-cyan/30 blur-3xl [animation-delay:-12s]" />
        <FloatingElement className="absolute -top-24 -right-16 size-72 rounded-full border border-white/20 sm:size-96">
          <div className="size-full rounded-full border border-white/15 [transform:scale(0.66)]" />
        </FloatingElement>
        <FloatingElement delay={2} className="absolute -bottom-28 -left-20 size-64 rounded-full border border-white/20">
          <div className="size-full" />
        </FloatingElement>
      </div>
      <Container className="relative">
        <Reveal className="flex flex-col items-center gap-4 text-center">
          <h2 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {title}
          </h2>
          {description && <p className="max-w-xl text-lg text-pretty text-primary-foreground/80">{description}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-3 [&_a]:btn-shine">{children}</div>
          {points && points.length > 0 && (
            <ul className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/85">
              {points.map((point) => (
                <li key={point} className="inline-flex items-center gap-1.5">
                  <CheckIcon className="size-4" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </Container>
      </div>
    </section>
  );
}
