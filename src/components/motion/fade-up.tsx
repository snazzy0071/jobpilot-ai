"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ElementType, ReactNode } from "react";

/**
 * Fades in while rising into place *on mount*, not on scroll — for
 * content that's already in the viewport when the page loads (a hero
 * headline, a modal's contents) where waiting for `whileInView` to
 * fire would either never trigger meaningfully or add a needless delay
 * to something the visitor should see immediately. Use ScrollReveal
 * instead for anything below the fold.
 */
export function FadeUp({
  children,
  className,
  delay = 0,
  duration = 0.5,
  distance = 16,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  distance?: number;
  as?: ElementType;
}) {
  const reducedMotion = useReducedMotion();
  const Tag = as;

  if (reducedMotion) {
    return <Tag className={className}>{children}</Tag>;
  }

  const MotionTag = motion[as as "div"] ?? motion.div;

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
    >
      {children}
    </MotionTag>
  );
}
