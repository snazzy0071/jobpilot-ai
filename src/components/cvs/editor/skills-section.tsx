"use client";

import { useRef, useState } from "react";
import { saveSkill, deleteSkill, toggleSkillVisibility, reorderSkills } from "@/lib/cvs/section-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AutosaveStatus } from "@/components/cvs/editor/autosave-status";
import { useAutosave } from "@/components/cvs/editor/use-autosave";
import { SectionList, type DragHandleProps } from "@/components/cvs/editor/section-list";
import { DeleteRowButton } from "@/components/cvs/editor/delete-row-button";
import { ToggleVisibilityButton } from "@/components/cvs/editor/toggle-visibility-button";
import { useCvSaves } from "@/components/cvs/editor/save-coordinator";
import type { CvSkill } from "@/lib/cvs/types";
import { PencilIcon, GripVerticalIcon } from "lucide-react";

function SkillForm({ versionId, initial, onDone }: { versionId: string; initial: CvSkill | null; onDone: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rowId, setRowId] = useState<string | null>(initial?.id ?? null);
  const { status, errorMessage, scheduleSave, flush } = useAutosave(saveSkill, {
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Skill</Label>
          <Input id="name" name="name" required defaultValue={initial?.name ?? ""} maxLength={100} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            placeholder="e.g. Programming Languages"
            defaultValue={initial?.category ?? ""}
            maxLength={100}
          />
        </div>
      </div>

      <AutosaveStatus status={status} errorMessage={errorMessage} />

      <Button type="button" variant="ghost" size="sm" onClick={finish} className="self-start">
        Done
      </Button>
    </form>
  );
}

export function SkillsSection({ versionId, items }: { versionId: string; items: CvSkill[] }) {
  const { track } = useCvSaves();
  async function handleReorder(orderedIds: string[]) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("orderedIds", JSON.stringify(orderedIds));
    await track("reorder", () => reorderSkills(undefined, formData));
  }

  return (
    <SectionList
      items={items}
      onReorder={handleReorder}
      addLabel="Add skill"
      emptyLabel="No skills added yet."
      renderForm={(item, onDone) => <SkillForm versionId={versionId} initial={item} onDone={onDone} />}
      renderSummary={(item, onEdit, dragHandleProps: DragHandleProps | null) => (
        <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${item.isVisible ? "" : "opacity-60"}`}>
          <div className="flex items-center gap-2">
            {dragHandleProps && (
              <button
                type="button"
                {...dragHandleProps}
                className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                aria-label="Drag to reorder"
              >
                <GripVerticalIcon className="size-4" />
              </button>
            )}
            <span className="text-sm font-medium">{item.name}</span>
            {item.category && (
              <Badge variant="secondary" className="text-xs font-normal">
                {item.category}
              </Badge>
            )}
            {!item.isVisible && (
              <Badge variant="outline" className="text-xs font-normal">
                Hidden from CV
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ToggleVisibilityButton action={toggleSkillVisibility} id={item.id} versionId={versionId} isVisible={item.isVisible} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit skill" onClick={onEdit}>
              <PencilIcon />
            </Button>
            <DeleteRowButton action={deleteSkill} id={item.id} versionId={versionId} label="Delete skill" />
          </div>
        </div>
      )}
    />
  );
}
