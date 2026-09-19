import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A slow, ambient panning gradient — CSS `animation`, not Framer
 * Motion, and deliberately not a "use client" component at all: a
 * continuously-animated background is exactly the case where a
 * compositor-driven CSS animation (globals.css's `animate-gradient-pan`
 * utility) beats a JS-driven one on every measure that matters here —
 * no main-thread work once running, no client bundle cost, and
 * `prefers-reduced-motion` is already handled globally for every CSS
 * animation in the app (see globals.css's own media-query rule), so
 * there's no separate reduced-motion branch to write or ship.
 *
 * `gradient` accepts any valid CSS background-image value — defaults
 * to the app's own brand gradient token. Renders a plain div; give it
 * size via `className` (absolute-fill, a fixed height, etc.) the same
 * way you would any decorative background layer.
 */
export function AnimatedGradient({
  className,
  gradient = "var(--gradient-brand)",
  children,
}: {
  className?: string;
  gradient?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("animate-gradient-pan", className)}
      style={{ backgroundImage: gradient }}
      aria-hidden={children ? undefined : true}
    >
      {children}
    </div>
  );
}
