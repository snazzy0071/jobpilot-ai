"use client";

import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { getCvTemplate } from "@/config/cv-templates";

/**
 * The template name/description card text, read from the same live value
 * the preview renders from. It used to be rendered on the server from the
 * page's data, so it kept showing the old template until a refresh even
 * though the preview beside it had already switched.
 */
export function CurrentTemplateSummary() {
  const { preview } = useCvPreview();
  const template = getCvTemplate(preview.template);
  return (
    <div className="min-w-0 flex-1" data-current-template={template.slug}>
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Template</p>
      <p className="truncate font-heading text-base font-semibold">{template.name}</p>
      <p className="line-clamp-1 text-sm text-muted-foreground">{template.description}</p>
    </div>
  );
}
