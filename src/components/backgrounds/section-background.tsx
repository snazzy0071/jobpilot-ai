import { AnimatedGradient } from "@/components/motion/animated-gradient";
import { FloatingElement } from "@/components/motion/floating-element";
import { cn } from "@/lib/utils";

/**
 * The one shared decorative background for public marketing sections —
 * every section that wants "richer" treatment renders this once,
 * instead of a bespoke gradient/grid/shape combination per page. A
 * plain Server Component: every piece it composes (bg-grid-fade,
 * AnimatedGradient, FloatingElement) is CSS-only with no client JS of
 * its own, so this whole layer costs nothing extra to hydrate.
 *
 * Absolutely positioned, `inset-0`, `overflow-hidden` on the wrapper,
 * `pointer-events-none` and `aria-hidden` throughout — this can never
 * intercept a click/tap meant for real content, or be announced to a
 * screen reader, and never causes the section itself to scroll wider
 * than its content. Callers give the *parent* `section` element
 * `position: relative` (Section already does) so this absolute layer
 * stays scoped to that one section, not the whole page.
 *
 * Deliberately never used on dashboard/admin: those need "very subtle
 * premium background movement only" (the separate `dashboard-glow`
 * utility, a slow opacity breathe with no grid/shapes at all) — this
 * component's grid + floating shapes are a public-marketing-specific
 * richness intentionally not offered there.
 *
 * Shapes are small (max 40px) and low-opacity (8-10%) on purpose — "no
 * huge blobs" was explicit; this reads as ambient texture, not a
 * decorative hero illustration competing with real content.
 */
export function SectionBackground({
  className,
  grid = true,
  glow = true,
  shapes = true,
}: {
  className?: string;
  /** The faint dot/line texture — usually left on; turn off for tone="primary"/"muted" sections where it would clash with an already-colored surface. */
  grid?: boolean;
  /** A soft, slowly-panning brand-gradient wash. */
  glow?: boolean;
  /** The 2 small floating accent circles. */
  shapes?: boolean;
}) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      {grid && <div className="absolute inset-0 bg-grid-fade" />}

      {glow && (
        <AnimatedGradient
          className="absolute inset-x-0 top-0 h-full opacity-[0.06] blur-3xl"
          gradient="var(--gradient-brand)"
        />
      )}

      {shapes && (
        <>
          <FloatingElement delay={0} className="absolute top-[12%] right-[8%] size-10 rounded-full bg-primary/10 blur-md">
            <div className="size-full" />
          </FloatingElement>
          <FloatingElement delay={2} className="absolute bottom-[15%] left-[6%] size-6 rounded-full bg-brand-secondary/10 blur-sm">
            <div className="size-full" />
          </FloatingElement>
        </>
      )}
    </div>
  );
}
