"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CoverLetterTemplate, CoverLetterParagraph } from "@/lib/cover-letters/types";

export type CoverLetterPreviewData = {
  template: CoverLetterTemplate;
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
  senderLocation: string | null;
  companyName: string;
  jobTitle: string;
  paragraphs: CoverLetterParagraph[];
};

/** A paragraph being actively typed into, keyed by its real id or "new" while adding — not yet saved. Same single-active-row model as CvPreviewProvider's live rows, since SectionList only ever has one row open for editing at a time. */
type LiveParagraph = { key: string; content: string };

type PreviewContextValue = {
  /** The merged view the paragraph editor and the live A4 preview both read — saved data with any live, unsaved edit overlaid. */
  preview: CoverLetterPreviewData;
  /** Switches the preview's template instantly, before updateCoverLetterTemplate's own round trip completes — the "live" in live template switching. */
  setLiveTemplate: (template: CoverLetterTemplate | null) => void;
  setLiveParagraph: (key: string, content: string | null) => void;
};

const PreviewContext = createContext<PreviewContextValue | null>(null);

/**
 * Holds the "as typed" state that makes the live A4 preview update
 * immediately, independent of the autosave round trip — same mechanism
 * as CvPreviewProvider (src/components/cvs/editor/preview-context.tsx),
 * scoped to what a cover letter actually has: paragraphs and a template
 * choice, not the many separately-editable sections a CV has.
 */
export function CoverLetterPreviewProvider({ initial, children }: { initial: CoverLetterPreviewData; children: ReactNode }) {
  // React's documented "adjust state when a prop changes" pattern —
  // a fresh `initial` from the server (after a save triggers
  // revalidatePath) replaces `saved` in the same render pass, same as
  // CvPreviewProvider.
  const [prevInitial, setPrevInitial] = useState(initial);
  const [saved, setSaved] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setSaved(initial);
  }

  const [liveTemplate, setLiveTemplateState] = useState<CoverLetterTemplate | null>(null);
  const [liveParagraph, setLiveParagraphState] = useState<LiveParagraph | null>(null);

  const preview = useMemo<CoverLetterPreviewData>(() => {
    const template = liveTemplate ?? saved.template;

    const paragraphs = saved.paragraphs.map((row) =>
      liveParagraph && liveParagraph.key === row.id ? { ...row, content: liveParagraph.content } : row,
    );
    if (liveParagraph && liveParagraph.key === "new") {
      paragraphs.push({ id: "preview-new-paragraph", content: liveParagraph.content, displayOrder: paragraphs.length });
    }

    return { ...saved, template, paragraphs };
  }, [saved, liveTemplate, liveParagraph]);

  const value: PreviewContextValue = {
    preview,
    setLiveTemplate: setLiveTemplateState,
    setLiveParagraph: (key, content) => setLiveParagraphState(content === null ? null : { key, content }),
  };

  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function useCoverLetterPreview(): PreviewContextValue {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("useCoverLetterPreview must be used within a CoverLetterPreviewProvider");
  return ctx;
}
