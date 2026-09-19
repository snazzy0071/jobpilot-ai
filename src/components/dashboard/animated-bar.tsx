"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * A progress/usage bar that fills once when it scrolls into view — the
 * same whileInView + reduced-motion pattern as marketing/metric-bar.tsx,
 * but with no built-in label, since dashboard bars need different
 * right-hand text ("3 of 8 used", "12 · 40%") than MetricBar's fixed
 * "{value}%". `value` is 0-100 and clamped.
 */
export function AnimatedBar({
  value,
  className,
  barClassName,
  delay = 0,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className={cn("h-full rounded-full bg-primary", barClassName)}
        initial={reducedMotion ? { width: `${pct}%` } : { width: 0 }}
        whileInView={{ width: `${pct}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay, ease: "easeOut" }}
      />
    </div>
  );
}
