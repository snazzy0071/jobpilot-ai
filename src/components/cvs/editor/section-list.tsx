"use client";

import { useState, type ReactNode } from "react";
import { Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

export type DragHandleProps = { onPointerDown: (event: React.PointerEvent) => void };

function DraggableRow<T>({ item, children }: { item: T; children: (dragHandleProps: DragHandleProps) => ReactNode }) {
  const controls = useDragControls();
  // WCAG 2.3.3: same reduced-motion override as section-order-list.tsx
  // — framer-motion's layout-reorder spring is JS-driven, so the
  // global CSS media query in globals.css can't reach it.
  const reducedMotion = useReducedMotion();
  return (
    <Reorder.Item value={item} as="div" dragListener={false} dragControls={controls} transition={reducedMotion ? { duration: 0 } : undefined}>
      {children({ onPointerDown: (event) => controls.start(event) })}
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

  function handleReorder(newOrder: T[]) {
    setLocalItems(newOrder);
    onReorder?.(newOrder.map((item) => item.id));
  }

  return (
    <div className="flex flex-col gap-3">
      {localItems.length === 0 && !adding && <p className="text-sm text-muted-foreground">{emptyLabel}</p>}

      {canReorder ? (
        <Reorder.Group axis="y" as="div" values={localItems} onReorder={handleReorder} className="flex flex-col gap-3">
          {localItems.map((item) => (
            <DraggableRow key={item.id} item={item}>
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
