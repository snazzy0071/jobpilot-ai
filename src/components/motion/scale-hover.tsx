"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A hover/press scale for things a *lift* (HoverLift) reads wrong for —
 * icon buttons, thumbnails, small tappable tiles — where growing
 * slightly in place feels more natural than moving upward. Only ever
 * takes already-rendered `children`, never a component reference, so
 * it's safe to call from a Server Component the same way HoverLift is
 * (see that component's own comment on why that distinction matters
 * for anything wrapping an `icon: LucideIcon`-style prop upstream).
 */
export function ScaleHover({
  children,
  scale = 1.04,
  tapScale = 0.97,
  enabled = true,
  className,
}: {
  children: ReactNode;
  /** Scale on hover. */
  scale?: number;
  /** Scale on press/tap — real touch feedback, not just a hover effect. */
  tapScale?: number;
  enabled?: boolean;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const active = enabled && !reducedMotion;

  return (
    <motion.div
      className={className}
      whileHover={active ? { scale } : undefined}
      whileTap={active ? { scale: tapScale } : undefined}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
