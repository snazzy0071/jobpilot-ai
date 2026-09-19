"use client";

import { useRef, useState } from "react";
import { saveCustomSection, deleteCustomSection, toggleCustomSectionVisibility, reorderCustomSections } from "@/lib/cvs/section-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AutosaveStatus } from "@/components/cvs/editor/autosave-status";
import { useAutosave } from "@/components/cvs/editor/use-autosave";
import { SectionList, type DragHandleProps } from "@/components/cvs/editor/section-list";
import { DeleteRowButton } from "@/components/cvs/editor/delete-row-button";
import { ToggleVisibilityButton } from "@/components/cvs/editor/toggle-visibility-button";
import { useCvSaves } from "@/components/cvs/editor/save-coordinator";
import type { CvCustomSection } from "@/lib/cvs/types";
import { PencilIcon, GripVerticalIcon } from "lucide-react";

function CustomSectionForm({
  versionId,
  initial,
  onDone,
}: {
  versionId: string;
  initial: CvCustomSection | null;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rowId, setRowId] = useState<string | null>(initial?.id ?? null);
  const { status, errorMessage, scheduleSave, flush } = useAutosave(saveCustomSection, {
    onSaved: (id) => {
      if (id) setRowId(id);
    },
  });

  function handleChange() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    if (rowId) formData.set("id", rowId);
    scheduleSave(formData);
  }

  async function finish() {
    const result = await flush();
    if (result && "error" in result) return;
    onDone();
  }

  return (
    <form ref={formRef} onChange={handleChange} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="id" value={rowId ?? ""} readOnly />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Section title</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder="e.g. Volunteering, Publications, Awards"
          defaultValue={initial?.title ?? ""}
          maxLength={200}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content">Content</Label>
        <Textarea id="content" name="content" rows={4} maxLength={4000} defaultValue={initial?.content ?? ""} />
      </div>

      <AutosaveStatus status={status} errorMessage={errorMessage} />

      <Button type="button" variant="ghost" size="sm" onClick={finish} className="self-start">
        Done
      </Button>
    </form>
  );
}

export function CustomSectionsSection({ versionId, items }: { versionId: string; items: CvCustomSection[] }) {
  const { track } = useCvSaves();
  async function handleReorder(orderedIds: string[]) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("orderedIds", JSON.stringify(orderedIds));
    await track("reorder", () => reorderCustomSections(undefined, formData));
  }

  return (
    <SectionList
      items={items}
      onReorder={handleReorder}
      addLabel="Add section"
      emptyLabel="No custom sections added yet — use this for anything not covered above, like Volunteering, Publications, or Awards."
      renderForm={(item, onDone) => <CustomSectionForm versionId={versionId} initial={item} onDone={onDone} />}
      renderSummary={(item, onEdit, dragHandleProps: DragHandleProps | null) => (
        <div className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${item.isVisible ? "" : "opacity-60"}`}>
          <div className="flex items-start gap-2">
            {dragHandleProps && (
              <button
                type="button"
                {...dragHandleProps}
                className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                aria-label="Drag to reorder"
              >
                <GripVerticalIcon className="size-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{item.title}</p>
                {!item.isVisible && (
                  <Badge variant="outline" className="text-xs font-normal">
                    Hidden from CV
                  </Badge>
                )}
              </div>
              {item.content && <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{item.content}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ToggleVisibilityButton
              action={toggleCustomSectionVisibility}
              id={item.id}
              versionId={versionId}
              isVisible={item.isVisible}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit section" onClick={onEdit}>
              <PencilIcon />
            </Button>
            <DeleteRowButton action={deleteCustomSection} id={item.id} versionId={versionId} label="Delete section" />
          </div>
        </div>
      )}
    />
  );
}
