"use client";

import { useState } from "react";
import { Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { GripVerticalIcon } from "lucide-react";
import { reorderSections } from "@/lib/cvs/actions";
import { useCvSaves } from "@/components/cvs/editor/save-coordinator";
import { SECTION_LABELS, type SectionKey } from "@/lib/cvs/types";

function DraggableChip({ sectionKey }: { sectionKey: SectionKey }) {
  const controls = useDragControls();
  // WCAG 2.3.3: framer-motion's own layout-reorder spring runs
  // regardless of OS motion preference — a CSS media query (see
  // globals.css) can't reach it, so this is the one place that needs
  // its own explicit reduced-motion check.
  const reducedMotion = useReducedMotion();
  return (
    <Reorder.Item
      value={sectionKey}
      as="div"
      dragListener={false}
      dragControls={controls}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm"
    >
      <button
        type="button"
        onPointerDown={(event) => controls.start(event)}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`Drag to reorder ${SECTION_LABELS[sectionKey]}`}
      >
        <GripVerticalIcon className="size-3.5" />
      </button>
      {SECTION_LABELS[sectionKey]}
    </Reorder.Item>
  );
}

/**
 * Reorders the CV's section *blocks* themselves (Skills before
 * Experience, say) — separate from each section's own internal
 * drag-reorder (`section-list.tsx`). Deliberately not built by wrapping
 * the actual Accordion items in Reorder.Item: Base UI's Accordion.Root
 * has its own expectations about its children being AccordionItem
 * elements directly, and wrapping them in motion.div drag containers
 * risks breaking that in ways not worth the coupling. This is a small,
 * separate chip list whose committed order the editor page then uses to
 * decide which order to render the real AccordionItems in.
 */
export function SectionOrderList({ versionId, order }: { versionId: string; order: SectionKey[] }) {
  const [prevOrder, setPrevOrder] = useState(order);
  const [localOrder, setLocalOrder] = useState(order);
  if (order !== prevOrder) {
    setPrevOrder(order);
    setLocalOrder(order);
  }

  const { track } = useCvSaves();
  async function handleReorder(newOrder: SectionKey[]) {
    setLocalOrder(newOrder);
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("order", JSON.stringify(newOrder));
    await track("reorder", () => reorderSections(undefined, formData));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Section order — drag to change how these appear on your CV
      </p>
      <Reorder.Group axis="x" as="div" values={localOrder} onReorder={handleReorder} className="flex flex-wrap gap-2">
        {localOrder.map((key) => (
          <DraggableChip key={key} sectionKey={key} />
        ))}
      </Reorder.Group>
    </div>
  );
}
