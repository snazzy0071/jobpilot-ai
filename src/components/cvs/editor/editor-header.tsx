"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { AlertCircleIcon, ArrowLeftIcon, CheckIcon, Loader2Icon, ScanSearchIcon } from "lucide-react";
import { renameCv, type CvActionResult } from "@/lib/cvs/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CvFormMessage } from "@/components/cvs/form-message";
import { TemplatePickerDialog } from "@/components/cvs/templates/template-picker-dialog";
import { atsPanelAnchorId } from "@/components/cvs/editor/ats-preflight-panel";
import { ExportPdfButton } from "@/components/cvs/editor/export-pdf-button";
import { useCvSaves } from "@/components/cvs/editor/save-coordinator";
import type { CvTemplateExtras } from "@/components/cvs/templates/types";
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
  templateContent,
}: {
  cvId: string;
  title: string;
  template: CvTemplate;
  atsScore: number | null;
  /** Skills, projects etc., so the template chooser's Preview can render the whole CV. */
  templateContent?: CvTemplateExtras;
}) {
  const [renameState, renameAction, renamePending] = useActionState<CvActionResult, FormData>(renameCv, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const { overall } = useCvSaves();
  // The editor's real save state: every autosaving section, the template, and the rename below.
  const renameError = renameState && "error" in renameState ? renameState.error : null;
  const saveState = renamePending || overall.status === "saving" ? "saving" : renameError || overall.status === "error" ? "error" : "saved";
  const saveMessage = renameError ?? overall.message;

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

        <span
          className={`flex shrink-0 items-center gap-1 text-xs ${saveState === "error" ? "text-destructive" : "text-muted-foreground"}`}
          role={saveState === "error" ? "alert" : "status"}
          data-save-state={saveState}
        >
          {saveState === "saving" && (
            <>
              <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> Saving…
            </>
          )}
          {saveState === "saved" && (
            <>
              <CheckIcon className="size-3.5" aria-hidden /> <span className="hidden sm:inline">All changes saved</span>
              <span className="sm:hidden">Saved</span>
            </>
          )}
          {saveState === "error" && (
            <>
              <AlertCircleIcon className="size-3.5" aria-hidden /> {saveMessage ?? "Couldn't save your changes."}
            </>
          )}
        </span>

        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          <TemplatePickerDialog currentTemplate={template} content={templateContent} triggerLabel="Templates" />
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
          <ExportPdfButton cvId={cvId} />
        </div>
      </div>

      <CvFormMessage state={renameState} />
    </div>
  );
}
