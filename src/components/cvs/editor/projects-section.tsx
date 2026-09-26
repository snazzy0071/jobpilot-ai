"use client";

import { useRef, useState } from "react";
import { saveProject, deleteProject, toggleProjectVisibility, reorderProjects } from "@/lib/cvs/section-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AutosaveStatus } from "@/components/cvs/editor/autosave-status";
import { useAutosave } from "@/components/cvs/editor/use-autosave";
import { dropEndDateWhenOngoing } from "@/lib/cvs/save-status";
import { SectionList, type DragHandleProps } from "@/components/cvs/editor/section-list";
import { DeleteRowButton } from "@/components/cvs/editor/delete-row-button";
import { ToggleVisibilityButton } from "@/components/cvs/editor/toggle-visibility-button";
import { useCvSaves } from "@/components/cvs/editor/save-coordinator";
import type { CvProject } from "@/lib/cvs/types";
import { PencilIcon, GripVerticalIcon } from "lucide-react";

function ProjectForm({ versionId, initial, onDone }: { versionId: string; initial: CvProject | null; onDone: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rowId, setRowId] = useState<string | null>(initial?.id ?? null);
  const [isOngoing, setIsOngoing] = useState(initial?.isOngoing ?? false);
  const { status, errorMessage, scheduleSave, flush } = useAutosave(saveProject, {
    onSaved: (id) => {
      if (id) setRowId(id);
    },
  });

  function buildFormData(): FormData | null {
    if (!formRef.current) return null;
    const formData = new FormData(formRef.current);
    if (rowId) formData.set("id", rowId);
    return dropEndDateWhenOngoing(formData, "isOngoing");
  }

  function handleChange() {
    const formData = buildFormData();
    if (formData) scheduleSave(formData);
  }

  function handleOngoingChange(checked: boolean) {
    setIsOngoing(checked);
    const formData = buildFormData();
    if (!formData) return;
    formData.set("isOngoing", checked ? "on" : "off");
    if (checked) formData.delete("endDate");
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
          <Label htmlFor="name">Project name</Label>
          <Input id="name" name="name" required defaultValue={initial?.name ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="url">Link</Label>
          <Input id="url" name="url" type="url" placeholder="https://" defaultValue={initial?.url ?? ""} maxLength={500} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={initial?.startDate ?? ""} />
        </div>
        {!isOngoing && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" name="endDate" type="date" defaultValue={initial?.endDate ?? ""} />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isOngoing" checked={isOngoing} onCheckedChange={handleOngoingChange} />
        This is ongoing
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="technologies">Technologies</Label>
        <Input
          id="technologies"
          name="technologies"
          placeholder="Comma-separated, e.g. Next.js, Postgres"
          defaultValue={(initial?.technologies ?? []).join(", ")}
        />
      </div>

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

export function ProjectsSection({ versionId, items }: { versionId: string; items: CvProject[] }) {
  const { track } = useCvSaves();
  async function handleReorder(orderedIds: string[]) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("orderedIds", JSON.stringify(orderedIds));
    await track("reorder", () => reorderProjects(undefined, formData));
  }

  return (
    <SectionList
      items={items}
      onReorder={handleReorder}
      addLabel="Add project"
      emptyLabel="No projects added yet."
      renderForm={(item, onDone) => <ProjectForm versionId={versionId} initial={item} onDone={onDone} />}
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
                <p className="font-medium">{item.name}</p>
                {!item.isVisible && (
                  <Badge variant="outline" className="text-xs font-normal">
                    Hidden from CV
                  </Badge>
                )}
              </div>
              {item.technologies.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.technologies.map((tech) => (
                    <Badge key={tech} variant="secondary" className="text-xs font-normal">
                      {tech}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ToggleVisibilityButton
              action={toggleProjectVisibility}
              id={item.id}
              versionId={versionId}
              isVisible={item.isVisible}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit project" onClick={onEdit}>
              <PencilIcon />
            </Button>
            <DeleteRowButton action={deleteProject} id={item.id} versionId={versionId} label="Delete project" />
          </div>
        </div>
      )}
    />
  );
}
