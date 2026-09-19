"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Opt-in per layout — wrap a layout's `{children}` in this to get a
 * subtle crossfade between routes; nothing wires this up globally, and
 * nothing existing uses it yet (this task builds the library, it
 * doesn't apply it to any page). `children` can be a Server Component
 * subtree passed down from a Server Component layout — a Client
 * Component receiving already-rendered Server Component output as
 * `children` is a normal, explicitly-supported Next.js pattern, not
 * something that needs its own client rendering.
 *
 * `usePathname()` is the AnimatePresence key: App Router layouts keep
 * the same component instance across a navigation within that layout,
 * so without an explicit key tied to the route, AnimatePresence would
 * never see an old element being removed and a new one added — it
 * would just see one element's content silently change, no exit/enter
 * to animate. `mode="wait"` finishes the old page's exit before the
 * new one enters (never two pages visibly overlapping mid-transition);
 * kept short (0.2s) specifically so that ordering doesn't read as a
 * pause.
 *
 * Reduced motion skips AnimatePresence entirely — a full route
 * transition is exactly the scale of motion `prefers-reduced-motion`
 * exists to remove, not just soften.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return <>{children}</>;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
