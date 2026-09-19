"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// `useReducedMotion()` is null until the client has read the media query, so the server-rendered markup (and the first
// client render) always starts hidden. Keying on the resolved value remounts the element the moment a reduced-motion
// preference is known, this time already at its final size — so those users never sit on an invisible bar waiting
// for an animation that will not play.
const WIDTH = 100;
const HEIGHT = 32;
const PAD = 2;

/**
 * A tiny trend line for a metric card. Decorative: the card's own text
 * carries the numbers, so it's hidden from assistive tech. The line draws
 * in once when it scrolls into view (skipped for reduced motion). A flat
 * series (all zeros, or one value) renders a flat line rather than
 * inventing a shape.
 */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const reducedMotion = useReducedMotion();
  if (values.length < 2) return null;

  const max = Math.max(...values, 0);
  const step = (WIDTH - PAD * 2) / (values.length - 1);
  const y = (value: number) => (max === 0 ? HEIGHT - PAD : HEIGHT - PAD - (value / max) * (HEIGHT - PAD * 2));
  const points = values.map((value, index) => [PAD + index * step, y(value)] as const);
  const line = points.map(([x, py], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${py.toFixed(2)}`).join(" ");
  const area = `${line} L${(WIDTH - PAD).toFixed(2)} ${HEIGHT} L${PAD} ${HEIGHT} Z`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden className={cn("overflow-visible text-primary", className)}>
      <motion.path
        key={`area-${reducedMotion ? "reduced" : "motion"}`}
        d={area}
        fill="currentColor"
        stroke="none"
        initial={{ opacity: reducedMotion ? 0.12 : 0 }}
        whileInView={{ opacity: 0.12 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
      />
      <motion.path
        key={`line-${reducedMotion ? "reduced" : "motion"}`}
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: reducedMotion ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </svg>
  );
}
