"use client";

import { useRef, useState } from "react";
import { saveCertification, deleteCertification, toggleCertificationVisibility, reorderCertifications } from "@/lib/cvs/section-actions";
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
import type { CvCertification } from "@/lib/cvs/types";
import { PencilIcon, GripVerticalIcon } from "lucide-react";

function CertificationForm({
  versionId,
  initial,
  onDone,
}: {
  versionId: string;
  initial: CvCertification | null;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [rowId, setRowId] = useState<string | null>(initial?.id ?? null);
  const { status, errorMessage, scheduleSave, flush } = useAutosave(saveCertification, {
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
          <Label htmlFor="name">Certification</Label>
          <Input id="name" name="name" required defaultValue={initial?.name ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issuingOrganization">Issuing organization</Label>
          <Input
            id="issuingOrganization"
            name="issuingOrganization"
            required
            defaultValue={initial?.issuingOrganization ?? ""}
            maxLength={200}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issueDate">Issue date</Label>
          <Input id="issueDate" name="issueDate" type="date" defaultValue={initial?.issueDate ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="expiryDate">Expiry date</Label>
          <Input id="expiryDate" name="expiryDate" type="date" defaultValue={initial?.expiryDate ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="credentialId">Credential ID</Label>
          <Input id="credentialId" name="credentialId" defaultValue={initial?.credentialId ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="credentialUrl">Credential link</Label>
          <Input
            id="credentialUrl"
            name="credentialUrl"
            type="url"
            placeholder="https://"
            defaultValue={initial?.credentialUrl ?? ""}
            maxLength={500}
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

export function CertificationsSection({ versionId, items }: { versionId: string; items: CvCertification[] }) {
  const { track } = useCvSaves();
  async function handleReorder(orderedIds: string[]) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("orderedIds", JSON.stringify(orderedIds));
    await track("reorder", () => reorderCertifications(undefined, formData));
  }

  return (
    <SectionList
      items={items}
      onReorder={handleReorder}
      addLabel="Add certification"
      emptyLabel="No certifications added yet."
      renderForm={(item, onDone) => <CertificationForm versionId={versionId} initial={item} onDone={onDone} />}
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
              <p className="text-sm text-muted-foreground">{item.issuingOrganization}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ToggleVisibilityButton
              action={toggleCertificationVisibility}
              id={item.id}
              versionId={versionId}
              isVisible={item.isVisible}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit certification" onClick={onEdit}>
              <PencilIcon />
            </Button>
            <DeleteRowButton action={deleteCertification} id={item.id} versionId={versionId} label="Delete certification" />
          </div>
        </div>
      )}
    />
  );
}
