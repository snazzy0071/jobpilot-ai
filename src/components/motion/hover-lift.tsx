"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * A subtle hover lift for card-like elements. Only takes already-rendered
 * `children`, never a component reference — safe to call from a Server
 * Component (see FeatureCard's own comment on why that distinction
 * matters here).
 */
export function HoverLift({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="h-full"
      whileHover={enabled && !reducedMotion ? { y: -4 } : undefined}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
