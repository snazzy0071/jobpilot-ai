"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [renameState, setRenameState] = useState<CvActionResult>(undefined);
  const { overall, report, register, track } = useCvSaves();
  // The editor's real save state: every autosaving section, the template, and the title below.
  const saveState = overall.status === "saving" ? "saving" : overall.status === "error" ? "error" : "saved";
  const saveMessage = overall.message;

  // The title autosaves like every other field: a short pause after typing, and immediately on blur/Enter. It reports
  // to the same coordinator as the section forms, so the header shows Saving/Saved/Error for it, an export waits for it,
  // and leaving the page saves it instead of dropping it.
  const typedTitle = useRef(title);
  const savedTitle = useRef(title);
  const lastFailed = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveTitle = useCallback(async (): Promise<CvActionResult> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const value = typedTitle.current;
    if (value === savedTitle.current && !lastFailed.current) {
      report("title", "saved");
      return undefined;
    }
    const formData = new FormData();
    formData.set("cvId", cvId);
    formData.set("title", value);
    const result = await track("title", () => renameCv(undefined, formData));
    if (result && "error" in result) {
      lastFailed.current = true;
    } else {
      lastFailed.current = false;
      savedTitle.current = value;
    }
    setRenameState(result);
    return result;
  }, [cvId, report, track]);

  function handleTitleChange(value: string) {
    typedTitle.current = value;
    report("title", "saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void saveTitle();
    }, 800);
  }

  useEffect(() => register("title", () => (timer.current || lastFailed.current ? saveTitle() : Promise.resolve(undefined))), [register, saveTitle]);

  // Leaving the page inside the pause must not drop the edit.
  useEffect(() => {
    return () => {
      if (timer.current) void saveTitle();
    };
  }, [saveTitle]);

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

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveTitle();
          }}
          className="min-w-0 flex-1"
        >
          <label htmlFor="title" className="sr-only">
            CV title
          </label>
          <Input
            id="title"
            name="title"
            defaultValue={title}
            maxLength={200}
            className="max-w-xs border-transparent bg-transparent font-heading text-lg font-semibold hover:border-input focus-visible:border-ring"
            onChange={(event) => handleTitleChange(event.target.value)}
            onBlur={() => void saveTitle()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveTitle();
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
