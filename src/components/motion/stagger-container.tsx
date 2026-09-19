"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ElementType, ReactNode } from "react";

/**
 * The orchestrating half of the stagger pair (with StaggerItem) — a
 * Motion "variant propagation" container: it never animates any style
 * of its own, it just carries a `visible`/`hidden` variant state that
 * every StaggerItem child inherits automatically (Motion's documented
 * pattern for this — a child with its own `variants` prop and no
 * `initial`/`animate` of its own picks up the nearest ancestor's
 * animation state under the same variant names). That's what makes the
 * children's entrances stagger relative to each other from one single
 * `whileInView` trigger on this element, instead of each child
 * computing its own independent delay (`index * 0.06`-style, which is
 * what FeatureCard/JourneySteps still do — this is the alternative,
 * not a replacement for those existing call sites).
 *
 * Reduced motion: renders the same children with no wrapping motion
 * element at all, so StaggerItem's own reduced-motion branch (which
 * checks the same hook independently) is what actually determines
 * final appearance either way.
 */
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
  initialDelay = 0,
  once = true,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Seconds between each StaggerItem child's entrance starting. */
  staggerDelay?: number;
  initialDelay?: number;
  once?: boolean;
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
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "0px 0px -80px 0px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay, delayChildren: initialDelay } },
      }}
    >
      {children}
    </MotionTag>
  );
}
