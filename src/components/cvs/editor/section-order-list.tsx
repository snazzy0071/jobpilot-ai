"use client";

import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { GripVerticalIcon } from "lucide-react";
import { reorderSections } from "@/lib/cvs/actions";
import { useCvSaves } from "@/components/cvs/editor/save-coordinator";
import { SECTION_LABELS, type SectionKey } from "@/lib/cvs/types";

function DraggableChip({
  sectionKey,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  sectionKey: SectionKey;
  onMove: (delta: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
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
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      transition={reducedMotion ? { duration: 0 } : undefined}
      className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm"
    >
      <button
        type="button"
        onPointerDown={(event) => controls.start(event)}
        // Keyboard alternative to dragging: focus the grip, then ←/→ (or ↑/↓) moves the section.
        onKeyDown={(event) => {
          const earlier = event.key === "ArrowLeft" || event.key === "ArrowUp";
          const later = event.key === "ArrowRight" || event.key === "ArrowDown";
          if (!earlier && !later) return;
          event.preventDefault();
          onMove(earlier ? -1 : 1);
        }}
        data-drag-handle={sectionKey}
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

  const groupRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<SectionKey | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Moving a chip re-inserts it in the DOM, which drops focus; hand it back to its grip so the next key press works.
  useEffect(() => {
    if (!refocus.current) return;
    groupRef.current?.querySelector<HTMLElement>(`[data-drag-handle="${refocus.current}"]`)?.focus();
    refocus.current = null;
  }, [localOrder]);

  function moveSection(key: SectionKey, delta: -1 | 1) {
    const from = localOrder.indexOf(key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= localOrder.length) return;
    const next = [...localOrder];
    next.splice(from, 1);
    next.splice(to, 0, key);
    refocus.current = key;
    setAnnouncement(`${SECTION_LABELS[key]} moved to position ${to + 1} of ${next.length}`);
    handleReorder(next);
  }

  const { track } = useCvSaves();

  // Saved once when a drag ends (not for every neighbour it passes); a keyboard move is one step and is saved at once.
  const dragging = useRef(false);
  const latestOrder = useRef(order);
  function handleReorder(newOrder: SectionKey[]) {
    setLocalOrder(newOrder);
    latestOrder.current = newOrder;
    if (!dragging.current) void persist(newOrder);
  }
  function handleDragStart() {
    dragging.current = true;
    latestOrder.current = localOrder;
  }
  function handleDragEnd() {
    dragging.current = false;
    if (latestOrder.current.some((key, index) => key !== order[index])) void persist(latestOrder.current);
  }

  async function persist(newOrder: SectionKey[]) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("order", JSON.stringify(newOrder));
    await track("reorder", () => reorderSections(undefined, formData));
  }

  return (
    <div ref={groupRef} className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Section order — drag to change how these appear on your CV
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <Reorder.Group axis="x" as="div" values={localOrder} onReorder={handleReorder} className="flex flex-wrap gap-2">
        {localOrder.map((key) => (
          <DraggableChip key={key} sectionKey={key} onMove={(delta) => moveSection(key, delta)} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
        ))}
      </Reorder.Group>
    </div>
  );
}
