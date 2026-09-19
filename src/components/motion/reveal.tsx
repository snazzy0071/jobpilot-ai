/**
 * Kept as the original name every existing marketing component already
 * imports (`@/components/motion/reveal`) — the real implementation is
 * now the general-purpose ScrollReveal (same default up/16px/0.5s
 * behaviour Reveal always had), so there's one animation engine behind
 * both names instead of two copies to keep in sync. New code should
 * import ScrollReveal directly; this file exists for the ~10 files
 * already using `Reveal`, not for anything new.
 */
export { ScrollReveal as Reveal } from "@/components/motion/scroll-reveal";
