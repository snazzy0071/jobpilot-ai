"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";
import type { SectionActionResult } from "@/lib/cvs/section-actions";
import { CvFormMessage } from "@/components/cvs/form-message";

export function DeleteRowButton({
  action,
  id,
  versionId,
  label,
}: {
  action: (prevState: SectionActionResult, formData: FormData) => Promise<SectionActionResult>;
  id: string;
  versionId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState<SectionActionResult, FormData>(action, undefined);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="versionId" value={versionId} />
      <Button type="submit" variant="ghost" size="icon-sm" disabled={pending} aria-label={label}>
        <Trash2Icon className="text-destructive" />
      </Button>
      <CvFormMessage state={state} />
    </form>
  );
}
