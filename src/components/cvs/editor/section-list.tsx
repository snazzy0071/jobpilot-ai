"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

/**
 * What a row's grip button spreads on: pointer drag as before, plus the keyboard — focus the grip and press
 * ↑/↓ to move the row (dragging alone isn't operable without a pointer). `data-drag-handle` lets the list put
 * focus back on the grip after the row has moved.
 */
export type DragHandleProps = {
  onPointerDown: (event: React.PointerEvent) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  "data-drag-handle": string;
};

function DraggableRow<T>({
  item,
  id,
  onMove,
  onDragStart,
  onDragEnd,
  children,
}: {
  item: T;
  id: string;
  onMove: (delta: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  children: (dragHandleProps: DragHandleProps) => ReactNode;
}) {
  const controls = useDragControls();
  // WCAG 2.3.3: same reduced-motion override as section-order-list.tsx
  // — framer-motion's layout-reorder spring is JS-driven, so the
  // global CSS media query in globals.css can't reach it.
  const reducedMotion = useReducedMotion();
  return (
    <Reorder.Item
      value={item}
      as="div"
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      transition={reducedMotion ? { duration: 0 } : undefined}
    >
      {children({
        onPointerDown: (event) => controls.start(event),
        onKeyDown: (event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          onMove(event.key === "ArrowUp" ? -1 : 1);
        },
        "data-drag-handle": id,
      })}
    </Reorder.Item>
  );
}

/**
 * Shared list/inline-edit/add/drag-reorder shell for every many-row CV
 * section (experience, education, skills, projects, certifications,
 * languages, custom sections). All seven have the identical
 * control-flow shape — a list of saved rows, one at a time swappable
 * into an edit form, an "add new" slot at the end, and (when nothing is
 * being edited) drag-to-reorder — only the fields inside each row's
 * form differ, which is what `renderSummary`/`renderForm` are for.
 *
 * Reordering is disabled while anything is being added/edited: mixing
 * an open edit form into the same drag-tracked list the rest of this
 * component reorders would need framer-motion's position measurements
 * to account for a form's height changing mid-drag, for a case (drag
 * while editing something else) that isn't a real editing pattern users
 * reach for anyway.
 */
export function SectionList<T extends { id: string }>({
  items,
  onReorder,
  renderSummary,
  renderForm,
  addLabel,
  emptyLabel,
}: {
  items: T[];
  onReorder?: (orderedIds: string[]) => void;
  renderSummary: (item: T, onEdit: () => void, dragHandleProps: DragHandleProps | null) => ReactNode;
  renderForm: (item: T | null, onDone: () => void) => ReactNode;
  addLabel: string;
  emptyLabel: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // React's documented "adjust state when a prop changes" pattern
  // (react.dev/learn/you-might-not-need-an-effect) rather than a
  // useEffect calling setState — keeps the locally-dragged order in
  // sync with the server's actual order (after any save, including a
  // reorder save, revalidates and hands down fresh `items`) without an
  // extra effect-driven render pass.
  const [prevItems, setPrevItems] = useState(items);
  const [localItems, setLocalItems] = useState(items);
  if (items !== prevItems) {
    setPrevItems(items);
    setLocalItems(items);
  }

  const canReorder = editingId === null && !adding && Boolean(onReorder);

  const listRef = useRef<HTMLDivElement>(null);
  const refocus = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // A drag reorders the list on screen every time the row passes a neighbour, but the new order is saved once, when the
  // row is dropped — not once per neighbour passed (a pile of overlapping saves, each refreshing the page data under
  // the drag). A keyboard move is a single step, so it is saved straight away.
  const dragging = useRef(false);
  const latestOrder = useRef<T[]>(items);
  function commit(order: T[]) {
    onReorder?.(order.map((item) => item.id));
  }
  function handleReorder(newOrder: T[]) {
    setLocalItems(newOrder);
    latestOrder.current = newOrder;
    if (!dragging.current) commit(newOrder);
  }
  function handleDragStart() {
    dragging.current = true;
    latestOrder.current = localItems;
  }
  function handleDragEnd() {
    dragging.current = false;
    if (latestOrder.current.some((item, index) => item.id !== items[index]?.id)) commit(latestOrder.current);
  }

  function moveItem(id: string, delta: -1 | 1) {
    const from = localItems.findIndex((item) => item.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= localItems.length) return;
    const next = [...localItems];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    refocus.current = id;
    setAnnouncement(`Moved to position ${to + 1} of ${next.length}`);
    handleReorder(next);
  }

  // Moving a row re-inserts it in the DOM, which drops focus; hand it back to the row's grip so the next key press works.
  useEffect(() => {
    if (!refocus.current) return;
    listRef.current?.querySelector<HTMLElement>(`[data-drag-handle="${refocus.current}"]`)?.focus();
    refocus.current = null;
  }, [localItems]);

  return (
    <div ref={listRef} className="flex flex-col gap-3">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {localItems.length === 0 && !adding && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}

      {canReorder ? (
        <Reorder.Group axis="y" as="div" values={localItems} onReorder={handleReorder} className="flex flex-col gap-3">
          {localItems.map((item) => (
            <DraggableRow key={item.id} item={item} id={item.id} onMove={(delta) => moveItem(item.id, delta)} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              {(dragHandleProps) => renderSummary(item, () => setEditingId(item.id), dragHandleProps)}
            </DraggableRow>
          ))}
        </Reorder.Group>
      ) : (
        localItems.map((item) =>
          editingId === item.id ? (
            <div key={item.id} className="rounded-lg border p-3">
              {renderForm(item, () => setEditingId(null))}
            </div>
          ) : (
            <div key={item.id}>{renderSummary(item, () => setEditingId(item.id), null)}</div>
          ),
        )
      )}

      {adding && <div className="rounded-lg border p-3">{renderForm(null, () => setAdding(false))}</div>}

      {!adding && editingId === null && (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} className="self-start">
          <PlusIcon /> {addLabel}
        </Button>
      )}
    </div>
  );
}
