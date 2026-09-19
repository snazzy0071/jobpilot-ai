/**
 * Kept as the original name every existing marketing component already
 * imports (`@/components/motion/counter`) — the real implementation is
 * now AnimatedCounter. New code should import that directly; this file
 * exists for the call sites already using `Counter`, not for anything
 * new.
 */
export { AnimatedCounter as Counter } from "@/components/motion/animated-counter";
