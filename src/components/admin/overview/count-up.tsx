"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { formatCount, type CountKind } from "@/components/admin/overview/format";

/**
 * A figure that counts up once as it scrolls into view, then holds. The
 * server-rendered text is already the final, correctly formatted value,
 * so with no JS, reduced motion, or a crawler it is simply the number,
 * never a flash of zero. Writes straight to the DOM node (not React
 * state): a count-up ticks dozens of times and a single text node doesn't
 * need a re-render per tick.
 */
export function CountUp({ value, kind = "number", className }: { value: number; kind?: CountKind; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!inView || reducedMotion || value === 0) return;
    const controls = animate(0, value, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate(latest) {
        if (ref.current) ref.current.textContent = formatCount(latest, kind);
      },
      onComplete() {
        if (ref.current) ref.current.textContent = formatCount(value, kind);
      },
    });
    return () => controls.stop();
  }, [inView, reducedMotion, value, kind]);

  return (
    <span ref={ref} className={className}>
      {formatCount(value, kind)}
    </span>
  );
}
