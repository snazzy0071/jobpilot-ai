"use client";

import { useRef, useState } from "react";
import { saveEducation, deleteEducation, reorderEducation } from "@/lib/cvs/section-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AutosaveStatus } from "@/components/cvs/editor/autosave-status";
import { useAutosave } from "@/components/cvs/editor/use-autosave";
import { SectionList, type DragHandleProps } from "@/components/cvs/editor/section-list";
import { DeleteRowButton } from "@/components/cvs/editor/delete-row-button";
import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { callAction } from "@/components/cvs/editor/call-action";
import type { CvEducation } from "@/lib/cvs/types";
import { PencilIcon, GripVerticalIcon } from "lucide-react";

function EducationForm({
  versionId,
  initial,
  onDone,
}: {
  versionId: string;
  initial: CvEducation | null;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rowId, setRowId] = useState<string | null>(initial?.id ?? null);
  const [isCurrent, setIsCurrent] = useState(initial?.isCurrent ?? false);
  const { setLiveEducation } = useCvPreview();
  const rowKey = initial?.id ?? "new";

  const { status, errorMessage, scheduleSave, flush } = useAutosave(saveEducation, {
    onSaved: (id) => {
      if (id) setRowId(id);
    },
  });

  function buildFormData(): FormData | null {
    if (!formRef.current) return null;
    const formData = new FormData(formRef.current);
    if (rowId) formData.set("id", rowId);
    return formData;
  }

  function handleChange() {
    const formData = buildFormData();
    if (!formData) return;
    setLiveEducation(rowKey, {
      institution: String(formData.get("institution") ?? ""),
      qualification: String(formData.get("qualification") ?? ""),
      fieldOfStudy: (String(formData.get("fieldOfStudy") ?? "") || null) as string | null,
      location: (String(formData.get("location") ?? "") || null) as string | null,
      startDate: (String(formData.get("startDate") ?? "") || null) as string | null,
      endDate: (String(formData.get("endDate") ?? "") || null) as string | null,
      isCurrent: formData.get("isCurrent") === "on",
      grade: (String(formData.get("grade") ?? "") || null) as string | null,
      description: (String(formData.get("description") ?? "") || null) as string | null,
    });
    scheduleSave(formData);
  }

  async function finish() {
    const result = await flush();
    if (result && "error" in result) return;
    setLiveEducation(rowKey, null);
    onDone();
  }

  function handleCurrentChange(checked: boolean) {
    setIsCurrent(checked);
    const formData = buildFormData();
    if (!formData) return;
    formData.set("isCurrent", checked ? "on" : "off");
    if (checked) formData.delete("endDate");
    setLiveEducation(rowKey, { isCurrent: checked, endDate: checked ? null : (initial?.endDate ?? null) });
    scheduleSave(formData);
  }

  return (
    <form ref={formRef} onChange={handleChange} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="id" value={rowId ?? ""} readOnly />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="institution">Institution</Label>
          <Input id="institution" name="institution" required defaultValue={initial?.institution ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qualification">Qualification</Label>
          <Input
            id="qualification"
            name="qualification"
            required
            defaultValue={initial?.qualification ?? ""}
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fieldOfStudy">Field of study</Label>
          <Input id="fieldOfStudy" name="fieldOfStudy" defaultValue={initial?.fieldOfStudy ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={initial?.location ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={initial?.startDate ?? ""} />
        </div>
        {!isCurrent && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" name="endDate" type="date" defaultValue={initial?.endDate ?? ""} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grade">Grade</Label>
          <Input id="grade" name="grade" defaultValue={initial?.grade ?? ""} maxLength={100} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isCurrent" checked={isCurrent} onCheckedChange={handleCurrentChange} />
        Currently studying here
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={initial?.description ?? ""} />
      </div>

      <AutosaveStatus status={status} errorMessage={errorMessage} />

      <Button type="button" variant="ghost" size="sm" onClick={finish} className="self-start">
        Done
      </Button>
    </form>
  );
}

export function EducationSection({ versionId, items }: { versionId: string; items: CvEducation[] }) {
  async function handleReorder(orderedIds: string[]) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("orderedIds", JSON.stringify(orderedIds));
    await callAction(() => reorderEducation(undefined, formData));
  }

  return (
    <SectionList
      items={items}
      onReorder={handleReorder}
      addLabel="Add qualification"
      emptyLabel="No qualifications added yet."
      renderForm={(item, onDone) => <EducationForm versionId={versionId} initial={item} onDone={onDone} />}
      renderSummary={(item, onEdit, dragHandleProps: DragHandleProps | null) => (
        <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
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
              <p className="font-medium">{item.qualification}</p>
              <p className="text-sm text-muted-foreground">
                {item.institution}
                {item.fieldOfStudy ? ` · ${item.fieldOfStudy}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.startDate ?? "—"} — {item.isCurrent ? "Present" : (item.endDate ?? "—")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit qualification" onClick={onEdit}>
              <PencilIcon />
            </Button>
            <DeleteRowButton action={deleteEducation} id={item.id} versionId={versionId} label="Delete qualification" />
          </div>
        </div>
      )}
    />
  );
}
