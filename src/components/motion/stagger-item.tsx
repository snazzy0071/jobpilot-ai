"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ElementType, ReactNode } from "react";

/**
 * Must be a direct-or-nested child of StaggerContainer — deliberately
 * has no `initial`/`whileInView` of its own (that's what StaggerContainer
 * is for); it only defines `variants` under the same "hidden"/"visible"
 * names, which is what lets it inherit the parent's animation state and
 * stagger timing instead of animating independently. Using this outside
 * a StaggerContainer renders it permanently in the "hidden" variant's
 * initial state, since nothing above it ever flips to "visible" — that's
 * intentional (a silent, obvious-looking bug) rather than silently
 * falling back to some other behaviour.
 */
export function StaggerItem({
  children,
  className,
  distance = 16,
  duration = 0.4,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  distance?: number;
  duration?: number;
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
      variants={{
        hidden: { opacity: 0, y: distance },
        visible: { opacity: 1, y: 0, transition: { duration, ease: "easeOut" } },
      }}
    >
      {children}
    </MotionTag>
  );
}
