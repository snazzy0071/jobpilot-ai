"use client";

import { useRef, useState } from "react";
import { saveExperience, deleteExperience, reorderExperience } from "@/lib/cvs/section-actions";
import { rewriteExperienceWithAi } from "@/lib/cvs/ai-actions";
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
import { AiRewritePanel } from "@/components/cvs/editor/ai-rewrite-panel";
import type { CvExperience } from "@/lib/cvs/types";
import { PencilIcon, GripVerticalIcon } from "lucide-react";

function ExperienceForm({
  versionId,
  initial,
  onDone,
}: {
  versionId: string;
  initial: CvExperience | null;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [rowId, setRowId] = useState<string | null>(initial?.id ?? null);
  const [isCurrent, setIsCurrent] = useState(initial?.isCurrent ?? false);
  const { setLiveExperience } = useCvPreview();
  const rowKey = initial?.id ?? "new";

  const { status, errorMessage, scheduleSave, flush } = useAutosave(saveExperience, {
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
    setLiveExperience(rowKey, {
      jobTitle: String(formData.get("jobTitle") ?? ""),
      employer: String(formData.get("employer") ?? ""),
      location: (String(formData.get("location") ?? "") || null) as string | null,
      startDate: String(formData.get("startDate") ?? ""),
      endDate: (String(formData.get("endDate") ?? "") || null) as string | null,
      isCurrent: formData.get("isCurrent") === "on",
      description: (String(formData.get("description") ?? "") || null) as string | null,
    });
    scheduleSave(formData);
  }

  async function finish() {
    const result = await flush();
    if (result && "error" in result) return;
    setLiveExperience(rowKey, null);
    onDone();
  }

  function handleAcceptDescription(suggestion: string) {
    if (!descriptionRef.current) return;
    descriptionRef.current.value = suggestion;
    handleChange();
  }

  function handleCurrentChange(checked: boolean) {
    setIsCurrent(checked);
    // isCurrent/endDate are linked but the checkbox's own change event
    // fires before React re-renders the (now-hidden) endDate field out
    // of the DOM, so build the snapshot from what we already know
    // rather than re-reading a field that's about to disappear.
    const formData = buildFormData();
    if (!formData) return;
    formData.set("isCurrent", checked ? "on" : "off");
    if (checked) formData.delete("endDate");
    setLiveExperience(rowKey, { isCurrent: checked, endDate: checked ? null : (initial?.endDate ?? null) });
    scheduleSave(formData);
  }

  return (
    <form ref={formRef} onChange={handleChange} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="id" value={rowId ?? ""} readOnly />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="jobTitle">Job title</Label>
          <Input id="jobTitle" name="jobTitle" required defaultValue={initial?.jobTitle ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employer">Employer</Label>
          <Input id="employer" name="employer" required defaultValue={initial?.employer ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" defaultValue={initial?.location ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" required defaultValue={initial?.startDate ?? ""} />
        </div>
        {!isCurrent && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" name="endDate" type="date" defaultValue={initial?.endDate ?? ""} />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isCurrent" checked={isCurrent} onCheckedChange={handleCurrentChange} />
        I currently work here
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          ref={descriptionRef}
          id="description"
          name="description"
          rows={4}
          maxLength={4000}
          defaultValue={initial?.description ?? ""}
        />
      </div>

      <AutosaveStatus status={status} errorMessage={errorMessage} />

      <AiRewritePanel
        getValue={() => descriptionRef.current?.value ?? ""}
        rewrite={(currentDescription) => {
          const formData = buildFormData();
          const jobTitle = String(formData?.get("jobTitle") ?? "").trim();
          return rewriteExperienceWithAi({ versionId, jobTitle, currentDescription });
        }}
        onAccept={handleAcceptDescription}
        label="Rewrite bullets with AI"
      />

      <Button type="button" variant="ghost" size="sm" onClick={finish} className="self-start">
        Done
      </Button>
    </form>
  );
}

export function ExperienceSection({ versionId, items }: { versionId: string; items: CvExperience[] }) {
  async function handleReorder(orderedIds: string[]) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("orderedIds", JSON.stringify(orderedIds));
    await callAction(() => reorderExperience(undefined, formData));
  }

  return (
    <SectionList
      items={items}
      onReorder={handleReorder}
      addLabel="Add role"
      emptyLabel="No roles added yet."
      renderForm={(item, onDone) => <ExperienceForm versionId={versionId} initial={item} onDone={onDone} />}
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
              <p className="font-medium">{item.jobTitle}</p>
              <p className="text-sm text-muted-foreground">
                {item.employer}
                {item.location ? ` · ${item.location}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {item.startDate} — {item.isCurrent ? "Present" : (item.endDate ?? "—")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit role" onClick={onEdit}>
              <PencilIcon />
            </Button>
            <DeleteRowButton action={deleteExperience} id={item.id} versionId={versionId} label="Delete role" />
          </div>
        </div>
      )}
    />
  );
}
