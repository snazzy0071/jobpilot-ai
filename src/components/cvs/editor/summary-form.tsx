"use client";

import { useRef } from "react";
import { saveSummary } from "@/lib/cvs/section-actions";
import { rewriteSummaryWithAi } from "@/lib/cvs/ai-actions";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { useAutosave } from "@/components/cvs/editor/use-autosave";
import { AutosaveStatus } from "@/components/cvs/editor/autosave-status";
import { AiRewritePanel } from "@/components/cvs/editor/ai-rewrite-panel";
import type { CvSummary } from "@/lib/cvs/types";

export function SummaryForm({ versionId, initial }: { versionId: string; initial: CvSummary | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const { setLiveSummary } = useCvPreview();
  const { status, errorMessage, scheduleSave } = useAutosave(saveSummary);

  function handleChange() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    setLiveSummary(String(formData.get("content") ?? ""));
    scheduleSave(formData);
  }

  function handleAccept(suggestion: string) {
    if (!contentRef.current) return;
    contentRef.current.value = suggestion;
    handleChange();
  }

  return (
    <form ref={formRef} onChange={handleChange} onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-3">
      <input type="hidden" name="versionId" value={versionId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="content">Professional summary</Label>
        <Textarea
          ref={contentRef}
          id="content"
          name="content"
          rows={5}
          maxLength={2000}
          placeholder="A short paragraph introducing your experience and what you're looking for next."
          defaultValue={initial?.content ?? ""}
        />
      </div>

      <AutosaveStatus status={status} errorMessage={errorMessage} />

      <AiRewritePanel
        getValue={() => contentRef.current?.value ?? ""}
        rewrite={(currentSummary) => rewriteSummaryWithAi({ versionId, currentSummary })}
        onAccept={handleAccept}
      />
    </form>
  );
}
