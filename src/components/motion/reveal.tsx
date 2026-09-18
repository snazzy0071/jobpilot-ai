"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ElementType, ReactNode } from "react";

/**
 * Subtle fade+rise entrance, used for marketing sections and grid items.
 * `whileInView` (not `animate`) doubles as both the "on scroll" case for
 * below-the-fold content and the "on load" case for anything already in
 * the viewport (hero content), so one component covers both without a
 * mode prop. `viewport={{ once: true }}` means it never re-fires on
 * scroll-back, so it can't become a distraction during normal browsing.
 * `useReducedMotion()` collapses it to a plain, already-visible element —
 * CSS's own `prefers-reduced-motion` rule in globals.css can't reach
 * framer-motion's JS-driven animations, so this check is the real gate.
 *
 * `as` defaults to "div" but must be set to the real tag (e.g. "li")
 * when wrapping a child that has structural HTML parent requirements —
 * an unstyled <div> between an <ol> and its <li>s would break list
 * semantics for assistive tech, which is exactly what this component
 * exists to avoid elsewhere in the app.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
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
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </MotionTag>
  );
}
