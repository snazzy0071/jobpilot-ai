import { Container } from "@/components/marketing/container";
import { AnimatedGradient } from "@/components/motion/animated-gradient";
import { FloatingElement } from "@/components/motion/floating-element";
import { Reveal } from "@/components/motion/reveal";

// Renders on a solid --primary background: pass buttons with a variant
// that contrasts against it (e.g. Button variant="secondary"), not the
// default variant, which is the same color as this background.
//
// Decoration is CSS-only and aria-hidden: a slow-panning coral/white wash,
// two concentric rings and a faint grid, all clipped to the section.
export function CtaSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-primary py-16 text-primary-foreground sm:py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <AnimatedGradient
          className="absolute inset-0 opacity-70"
          gradient="radial-gradient(ellipse 60% 80% at 100% 0%, rgb(255 255 255 / 0.14), transparent 60%), radial-gradient(ellipse 55% 70% at 0% 100%, color-mix(in oklch, var(--brand-secondary), transparent 62%), transparent 65%)"
        />
        <div className="bg-grid-fade absolute inset-0 opacity-60" />
        <FloatingElement className="absolute -top-24 -right-16 size-72 rounded-full border border-white/15 sm:size-96">
          <div className="size-full rounded-full border border-white/10 [transform:scale(0.66)]" />
        </FloatingElement>
        <FloatingElement delay={2} className="absolute -bottom-28 -left-20 size-64 rounded-full border border-white/15">
          <div className="size-full" />
        </FloatingElement>
      </div>
      <Container className="relative">
        <Reveal className="flex flex-col items-center gap-4 text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            {title}
          </h2>
          {description && <p className="max-w-xl text-lg text-pretty text-primary-foreground/80">{description}</p>}
          <div className="mt-3 flex flex-wrap justify-center gap-3">{children}</div>
        </Reveal>
      </Container>
    </section>
  );
}
