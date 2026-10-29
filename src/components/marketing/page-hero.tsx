import { Section } from "@/components/marketing/section";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Reveal } from "@/components/motion/reveal";
import { HeroBackdrop } from "@/components/marketing/hero-backdrop";
import { cn } from "@/lib/utils";

/**
 * The shared hero for every public page: the brand glow + grid +
 * floating-shapes background (via Section), an eyebrow / headline /
 * lead / actions column, and, when a `visual` is passed, a two-column
 * composition with that product mockup or illustration beside the
 * copy. Without a `visual` it falls back to a centred layout so
 * text-only pages (legal, status) still get the same background and
 * type scale.
 *
 * Server Component: all motion lives in the Reveal wrappers.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  actions,
  visual,
  breadcrumbs,
  badge,
  footer,
  align,
  className,
}: {
  eyebrow?: string;
  /** Rendered inside the page's single h1; pass a string, optionally with GradientText spans. */
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  visual?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  badge?: React.ReactNode;
  /** Full-width content under the columns (stat strip, quick answer). */
  footer?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  const centered = (align ?? (visual ? "left" : "center")) === "center";

  const copy = (
    <Reveal
      className={cn(
        "flex flex-col gap-5",
        centered ? "mx-auto max-w-3xl items-center text-center" : "items-center text-center lg:items-start lg:text-left",
      )}
    >
      {badge}
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">{title}</h1>
      {description && <div className="max-w-2xl text-lg text-pretty text-muted-foreground">{description}</div>}
      {actions && (
        <div className={cn("flex flex-wrap gap-3", centered ? "justify-center" : "justify-center lg:justify-start")}>
          {actions}
        </div>
      )}
    </Reveal>
  );

  return (
    // `decorative={false}`: this section already gets its own wash via the `hero-glow` class (sized
    // and positioned specifically for a hero) — layering Section's own default SectionBackground glow
    // underneath it doubled up the blur behind the one composition (the product mockup/floating
    // cards) where a clean, uncluttered backdrop matters most.
    <Section decorative={false} className={cn("-mt-[68px] overflow-hidden pt-36 pb-14 sm:pt-44 sm:pb-24", className)}>
      <HeroBackdrop intensity="soft" />
      {breadcrumbs && <div className="mb-8">{breadcrumbs}</div>}
      {visual ? (
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          {copy}
          <Reveal delay={0.15} direction="left" distance={24} className="relative">
            {visual}
          </Reveal>
        </div>
      ) : (
        copy
      )}
      {footer && <div className="mt-12 sm:mt-16">{footer}</div>}
    </Section>
  );
}
