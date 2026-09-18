"use client";

import { useCoverLetterPreview } from "@/components/cover-letters/editor-preview-context";
import { CoverLetterTemplateRenderer } from "@/components/cover-letters/templates/template-renderer";

/** The editor's live A4 preview panel — a thin adapter over the template engine, same role as CvPreview. Everything it renders comes from CoverLetterPreviewProvider's merged `preview` value, so a keystroke or a template switch shows up immediately, before any save completes. */
export function CoverLetterPreview() {
  const { preview } = useCoverLetterPreview();
  return <CoverLetterTemplateRenderer templateSlug={preview.template} data={preview} />;
}
