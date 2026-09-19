/**
 * JobPilot AI's reusable animation system, built on Framer Motion
 * ("Motion for React") — one place to import any of it from. Each
 * component's own file documents the specific pattern/tradeoff it's
 * built on (Motion's variant-propagation docs for the stagger pair,
 * `whileInView` for scroll reveals, plain CSS for the two continuous
 * ambient effects); this file is just the index, not where any of that
 * reasoning lives.
 *
 * `Reveal`/`Counter` (the pre-existing names some marketing components
 * already import) are intentionally NOT re-exported here — they still
 * work as direct imports for backward compatibility, but new code
 * should use ScrollReveal/AnimatedCounter below instead.
 *
 * Only FadeUp/ScrollReveal/StaggerContainer/StaggerItem/HoverLift/
 * ScaleHover/AnimatedCounter/PageTransition are "use client" — see
 * animated-gradient.tsx and floating-element.tsx's own comments for
 * why those two specifically aren't.
 */
export { FadeUp } from "@/components/motion/fade-up";
export { ScrollReveal } from "@/components/motion/scroll-reveal";
export { StaggerContainer } from "@/components/motion/stagger-container";
export { StaggerItem } from "@/components/motion/stagger-item";
export { HoverLift } from "@/components/motion/hover-lift";
export { ScaleHover } from "@/components/motion/scale-hover";
export { AnimatedCounter } from "@/components/motion/animated-counter";
export { AnimatedGradient } from "@/components/motion/animated-gradient";
export { FloatingElement } from "@/components/motion/floating-element";
export { PageTransition } from "@/components/motion/page-transition";
