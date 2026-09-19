import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A gentle, continuous vertical bob — CSS `animation`
 * (globals.css's `animate-float`), not Framer Motion, for the same
 * "no main-thread cost, no client bundle cost, reduced-motion already
 * handled globally" reasoning as AnimatedGradient. Not a "use client"
 * component: nothing here needs to run in the browser to decide
 * anything, it's a static class name.
 *
 * For decorative ambient motion only (an icon, a small floating
 * card/chip) — this is deliberately *not* what marketing/floating-chip.tsx
 * uses (that component needs its own entrance animation and a delayed
 * start, which does need Framer Motion's JS timing control); reach for
 * this one when the element is already on screen and just needs a
 * subtle "alive" quality, nothing more.
 */
export function FloatingElement({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds of negative animation-delay offset, so multiple floating elements on one screen don't bob in visible unison. */
  delay?: number;
}) {
  return (
    <div className={cn("animate-float", className)} style={delay ? { animationDelay: `-${delay}s` } : undefined}>
      {children}
    </div>
  );
}
