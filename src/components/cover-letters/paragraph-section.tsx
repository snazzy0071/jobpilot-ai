"use client";

import { useRef, useState } from "react";
import { PencilIcon, GripVerticalIcon } from "lucide-react";
import { saveParagraph, deleteParagraph, reorderParagraphs } from "@/lib/cover-letters/paragraph-actions";
import { regenerateParagraph, resolveCoverLetterParagraphRewrite } from "@/lib/cover-letters/rewrite-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AutosaveStatus } from "@/components/cvs/editor/autosave-status";
import { useAutosave } from "@/components/cvs/editor/use-autosave";
import { SectionList, type DragHandleProps } from "@/components/cvs/editor/section-list";
import { DeleteRowButton } from "@/components/cvs/editor/delete-row-button";
import { callAction } from "@/components/cvs/editor/call-action";
import { AiRewritePanel } from "@/components/cvs/editor/ai-rewrite-panel";
import { useCoverLetterPreview } from "@/components/cover-letters/editor-preview-context";
import type { CoverLetterParagraph } from "@/lib/cover-letters/types";

function ParagraphForm({
  versionId,
  initial,
  index,
  total,
  otherParagraphs,
  onDone,
}: {
  versionId: string;
  initial: CoverLetterParagraph | null;
  index: number;
  total: number;
  otherParagraphs: string;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [rowId, setRowId] = useState<string | null>(initial?.id ?? null);
  const { setLiveParagraph } = useCoverLetterPreview();
  const rowKey = initial?.id ?? "new";

  const { status, errorMessage, scheduleSave, flush } = useAutosave(saveParagraph, {
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
    setLiveParagraph(rowKey, String(formData.get("content") ?? ""));
    scheduleSave(formData);
  }

  async function finish() {
    const result = await flush();
    if (result && "error" in result) return;
    setLiveParagraph(rowKey, null);
    onDone();
  }

  function handleAccept(suggestion: string) {
    if (!contentRef.current) return;
    contentRef.current.value = suggestion;
    handleChange();
  }

  return (
    <form ref={formRef} onChange={handleChange} onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3">
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="id" value={rowId ?? ""} readOnly />

      <Textarea
        ref={contentRef}
        name="content"
        rows={5}
        maxLength={4000}
        defaultValue={initial?.content ?? ""}
        placeholder="Write this paragraph..."
      />

      <AutosaveStatus status={status} errorMessage={errorMessage} />

      {rowId && (
        <AiRewritePanel
          getValue={() => contentRef.current?.value ?? ""}
          rewrite={(currentContent) =>
            regenerateParagraph({
              versionId,
              paragraphId: rowId,
              paragraphContent: currentContent,
              paragraphIndex: index,
              totalParagraphs: total,
              otherParagraphs,
            })
          }
          resolve={(rewriteId, status) => resolveCoverLetterParagraphRewrite({ rewriteId, status })}
          onAccept={handleAccept}
          label="Regenerate with AI"
        />
      )}

      <Button type="button" variant="ghost" size="sm" onClick={finish} className="self-start">
        Done
      </Button>
    </form>
  );
}

/**
 * The paragraph-based letter body — reuses the exact CV-editor shell
 * (SectionList: add/edit/reorder-by-drag) that already drives every
 * many-row CV section, so this is genuinely a new "section" in the same
 * sense experience/education/etc. are, not a bespoke UI. Regenerate is
 * only offered once a paragraph has a real id (a brand-new, unsaved
 * paragraph has nothing yet for the AI to rewrite against).
 */
export function ParagraphSection({ versionId, paragraphs }: { versionId: string; paragraphs: CoverLetterParagraph[] }) {
  async function handleReorder(orderedIds: string[]) {
    const formData = new FormData();
    formData.set("versionId", versionId);
    formData.set("orderedIds", JSON.stringify(orderedIds));
    await callAction(() => reorderParagraphs(undefined, formData));
  }

  return (
    <SectionList
      items={paragraphs}
      onReorder={handleReorder}
      addLabel="Add paragraph"
      emptyLabel="No paragraphs yet."
      renderForm={(item, onDone) => {
        const index = item ? paragraphs.findIndex((paragraph) => paragraph.id === item.id) + 1 : paragraphs.length + 1;
        const otherParagraphs = paragraphs
          .filter((paragraph) => paragraph.id !== item?.id)
          .map((paragraph) => paragraph.content)
          .join("\n\n");
        return (
          <ParagraphForm
            versionId={versionId}
            initial={item}
            index={index}
            total={Math.max(paragraphs.length, index)}
            otherParagraphs={otherParagraphs}
            onDone={onDone}
          />
        );
      }}
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
            <p className="line-clamp-3 text-sm whitespace-pre-wrap">{item.content}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Edit paragraph" onClick={onEdit}>
              <PencilIcon />
            </Button>
            <DeleteRowButton action={deleteParagraph} id={item.id} versionId={versionId} label="Delete paragraph" />
          </div>
        </div>
      )}
    />
  );
}
