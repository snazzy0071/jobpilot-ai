"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A small absolutely-positioned card, meant to sit at the edge of a
 * bigger product mockup (the hero CV card, the ATS score panel) —
 * fades/rises in on scroll like Reveal, then holds a slow, tiny float
 * loop so the whole composition doesn't feel static without ever
 * drawing the eye away from the real content next to it. Reduced
 * motion: appears in place, no float loop.
 */
export function FloatingChip({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn("absolute z-10 rounded-xl border bg-card px-3 py-2 shadow-floating", className)}
      initial={{ opacity: 0, scale: 0.85 }}
      whileInView={
        reducedMotion
          ? { opacity: 1, scale: 1 }
          : { opacity: 1, scale: 1, y: [0, -6, 0] }
      }
      viewport={{ once: true }}
      transition={
        reducedMotion
          ? { duration: 0.4, delay }
          : {
              opacity: { duration: 0.4, delay },
              scale: { duration: 0.4, delay },
              y: { duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.4 },
            }
      }
    >
      {children}
    </motion.div>
  );
}
