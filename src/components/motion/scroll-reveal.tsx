"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ElementType, ReactNode } from "react";

const DIRECTION_OFFSET: Record<"up" | "down" | "left" | "right", { x?: number; y?: number }> = {
  up: { y: 1 },
  down: { y: -1 },
  left: { x: 1 },
  right: { x: -1 },
};

/**
 * The general-purpose scroll-triggered entrance — fades in while
 * sliding a short distance from one edge, once, the first time it
 * scrolls into view. `whileInView` (not `animate`) doubles as both the
 * "on scroll" case for below-the-fold content and the "on load" case
 * for anything already in the viewport (a hero), so one component
 * covers both without a separate mode prop. `viewport={{ once: true }}`
 * means it never re-fires scrolling back up, so it can't become a
 * distraction during normal browsing.
 *
 * `useReducedMotion()` is the real gate, not CSS: this animates `y`/`x`
 * transforms via Framer's JS engine, which the CSS-only
 * `prefers-reduced-motion` rule in globals.css can't reach. Reduced
 * motion collapses this to a plain, already-visible element — same
 * final DOM, no animation.
 *
 * `as` defaults to "div" but must be set to the real tag (e.g. "li")
 * when wrapping a child that has structural HTML parent requirements —
 * an unstyled <div> between an <ol> and its <li>s would break list
 * semantics for assistive tech.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  duration = 0.5,
  distance = 16,
  direction = "up",
  once = true,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  /** Pixels travelled into place. */
  distance?: number;
  direction?: "up" | "down" | "left" | "right";
  /** false re-triggers every time it re-enters the viewport — only ever turn this on for a deliberate, repeatable effect, not default entrance content. */
  once?: boolean;
  as?: ElementType;
}) {
  const reducedMotion = useReducedMotion();
  const Tag = as;

  if (reducedMotion) {
    return <Tag className={className}>{children}</Tag>;
  }

  const MotionTag = motion[as as "div"] ?? motion.div;
  const offset = DIRECTION_OFFSET[direction];

  return (
    <MotionTag
      className={className}
      initial={{
        opacity: 0,
        x: offset.x ? offset.x * distance : undefined,
        y: offset.y ? offset.y * distance : undefined,
      }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, margin: "0px 0px -80px 0px" }}
      transition={{ duration, delay, ease: "easeOut" }}
    >
      {children}
    </MotionTag>
  );
}
