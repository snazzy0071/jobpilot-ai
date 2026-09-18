import type { SectionKey } from "@/lib/cvs/types";

/**
 * Expands (if collapsed) and scrolls to a section's accordion item in the
 * CV editor — each `AccordionItem` in the editor page carries
 * `id={sectionAnchorId(key)}` for exactly this. DOM-based rather than
 * lifting the Accordion into controlled state, since nothing else about
 * it needs to be controlled — Base UI sets `aria-expanded` on the
 * trigger regardless of controlled/uncontrolled use.
 */
export function sectionAnchorId(key: SectionKey): string {
  return `cv-section-${key}`;
}

export function jumpToSection(key: SectionKey): void {
  const item = document.getElementById(sectionAnchorId(key));
  if (!item) return;

  const trigger = item.querySelector<HTMLElement>('[data-slot="accordion-trigger"]');
  const wasCollapsed = trigger?.getAttribute("aria-expanded") === "false";
  if (trigger && wasCollapsed) trigger.click();

  const scroll = () => item.scrollIntoView({ behavior: "smooth", block: "start" });
  if (wasCollapsed) {
    // trigger.click() queues a React/Base UI state update rather than
    // applying it synchronously — scrolling on the same tick measures
    // the item's still-collapsed position. Two rAFs guarantee the
    // "open" state has actually committed to the DOM before scrolling.
    requestAnimationFrame(() => requestAnimationFrame(scroll));
  } else {
    scroll();
  }
}
