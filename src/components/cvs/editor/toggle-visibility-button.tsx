"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import type { SectionActionResult } from "@/lib/cvs/section-actions";
import { CvFormMessage } from "@/components/cvs/form-message";

export function ToggleVisibilityButton({
  action,
  id,
  versionId,
  isVisible,
}: {
  action: (prevState: SectionActionResult, formData: FormData) => Promise<SectionActionResult>;
  id: string;
  versionId: string;
  isVisible: boolean;
}) {
  const [state, formAction, pending] = useActionState<SectionActionResult, FormData>(action, undefined);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="versionId" value={versionId} />
      {/* Submits the opposite of the current value — the client already knows it, no need to read-then-flip server-side. */}
      <input type="hidden" name="isVisible" value={String(!isVisible)} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={isVisible ? "Hide from CV" : "Show on CV"}
        title={isVisible ? "Visible on CV — click to hide" : "Hidden from CV — click to show"}
      >
        {isVisible ? <EyeIcon /> : <EyeOffIcon className="text-muted-foreground" />}
      </Button>
      <CvFormMessage state={state} />
    </form>
  );
}
