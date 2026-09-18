"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { ArrowLeftIcon, DownloadIcon, ScanSearchIcon, CheckIcon } from "lucide-react";
import { renameCv, type CvActionResult } from "@/lib/cvs/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CvFormMessage } from "@/components/cvs/form-message";
import { TemplatePickerDialog } from "@/components/cvs/templates/template-picker-dialog";
import { atsPanelAnchorId } from "@/components/cvs/editor/ats-preflight-panel";
import type { CvTemplate } from "@/lib/cvs/types";

/**
 * reference/auth/create-cv.png's single-row toolbar (All CVs, title,
 * save status, Templates, ATS scan, Done, PDF) — every control here
 * already existed (rename, template picker, ATS panel, PDF export),
 * just regrouped into one bar instead of a label/field grid. The title
 * field now saves on blur/Enter instead of needing a separate visible
 * "Rename" button — same `renameCv` action, just a lighter-weight
 * trigger, matching the reference's plain title field with no button
 * next to it. "Done" isn't a real completion state (the CV autosaves
 * continuously either way) — it's the same destination as "All CVs",
 * just styled as the reference's primary action.
 */
export function EditorHeader({
  cvId,
  title,
  template,
  atsScore,
}: {
  cvId: string;
  title: string;
  template: CvTemplate;
  atsScore: number | null;
}) {
  const [renameState, renameAction, renamePending] = useActionState<CvActionResult, FormData>(renameCv, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  function scrollToAtsPanel() {
    document.getElementById(atsPanelAnchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/cvs"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" /> All CVs
        </Link>

        <form ref={formRef} action={renameAction} className="min-w-0 flex-1">
          <input type="hidden" name="cvId" value={cvId} />
          <label htmlFor="title" className="sr-only">
            CV title
          </label>
          <Input
            id="title"
            name="title"
            defaultValue={title}
            maxLength={200}
            className="max-w-xs border-transparent bg-transparent font-heading text-lg font-semibold hover:border-input focus-visible:border-ring"
            onBlur={() => formRef.current?.requestSubmit()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
        </form>

        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {renamePending ? "Saving…" : "All changes saved"}
        </span>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          <TemplatePickerDialog cvId={cvId} currentTemplate={template} triggerLabel="Templates" />
          <Button type="button" variant="outline" size="sm" onClick={scrollToAtsPanel}>
            <ScanSearchIcon /> ATS scan
            {atsScore !== null && (
              <Badge variant="secondary" className="ml-0.5">
                {atsScore}
              </Badge>
            )}
          </Button>
          <Button size="sm" render={<Link href="/dashboard/cvs" />}>
            <CheckIcon /> Done
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<a href={`/api/cvs/${cvId}/export`} target="_blank" rel="noopener noreferrer" />}
          >
            <DownloadIcon /> PDF
          </Button>
        </div>
      </div>

      <CvFormMessage state={renameState} />
    </div>
  );
}
