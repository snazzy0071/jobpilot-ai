"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, animate } from "framer-motion";

/**
 * Counts up from 0 to `value` once it scrolls into view, then holds —
 * never re-triggers on scroll-back (`once: true`), same rule
 * ScrollReveal follows. Reduced-motion and no-JS both just show the
 * final number (the DOM text starts at `value`, not 0, so there's no
 * flash-of-zero for a crawler or a user who never triggers the
 * effect). Writes the number directly to the DOM node
 * (`ref.current.textContent`) rather than through React state — a
 * count-up ticks many times a second, and routing that through
 * `setState`/re-render for a single text node is needless React-level
 * overhead for something Motion's own `animate()` can drive directly.
 */
export function AnimatedCounter({
  value,
  suffix = "",
  duration = 1.2,
  className,
}: {
  value: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(0);

  useEffect(() => {
    if (!inView || reducedMotion) return;
    const controls = animate(motionValue, value, {
      duration,
      ease: "easeOut",
      onUpdate(latest) {
        if (ref.current) ref.current.textContent = `${Math.round(latest).toLocaleString()}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, reducedMotion, motionValue, value, duration, suffix]);

  return (
    <span ref={ref} className={className}>
      {reducedMotion ? `${value.toLocaleString()}${suffix}` : `0${suffix}`}
    </span>
  );
}
