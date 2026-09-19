"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * One app-wide switch for JS-driven motion: with
 * `prefers-reduced-motion: reduce`, every framer-motion component beneath
 * this — including ones that never call `useReducedMotion()` themselves,
 * such as a `whileHover` lift — drops its transform and layout animations
 * (opacity still fades). The CSS side of reduced motion is the global
 * media query in globals.css; this covers the part CSS can't reach.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
