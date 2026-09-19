"use client";

import { ArrowLeftIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { AtsSafeBadge } from "@/components/cvs/templates/template-card";
import { TemplateRenderer } from "@/components/cvs/templates/template-renderer";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import { Button } from "@/components/ui/button";
import { CV_TEMPLATE_STYLE_LABELS, CV_TEMPLATE_LAYOUT_LABELS, type CvTemplateDefinition } from "@/config/cv-templates";

/**
 * Full-size, live preview of one template — rendered by the real template
 * engine (real fonts, real A4 pagination) with the user's own CV content
 * when there is some, or clearly-labelled sample content when the CV is
 * still empty. Nothing is applied until "Use template" is pressed, so
 * flicking between templates with the arrows is free.
 */
export function TemplatePreviewPanel({
  template,
  data,
  usingSample,
  current,
  position,
  total,
  onBack,
  onStep,
  onUse,
}: {
  template: CvTemplateDefinition;
  data: CvTemplateContentData;
  usingSample: boolean;
  current: boolean;
  position: number;
  total: number;
  onBack: () => void;
  onStep: (direction: -1 | 1) => void;
  onUse: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 pr-9">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeftIcon /> All templates
        </Button>

        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-heading text-base font-semibold">{template.name}</p>
            <AtsSafeBadge />
          </div>
          <p className="text-xs text-muted-foreground">
            {CV_TEMPLATE_STYLE_LABELS[template.style]} · {CV_TEMPLATE_LAYOUT_LABELS[template.layout]} — {template.recommendedFor}
          </p>
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Browse templates">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => onStep(-1)} disabled={total < 2} aria-label="Previous template">
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-12 text-center text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {position} / {total}
          </span>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => onStep(1)} disabled={total < 2} aria-label="Next template">
            <ChevronRightIcon />
          </Button>
        </div>

        <Button type="button" size="sm" onClick={onUse} disabled={current}>
          {current ? (
            <>
              <CheckIcon /> In use
            </>
          ) : (
            "Use template"
          )}
        </Button>
      </div>

      <div className="max-h-[62vh] overflow-y-auto rounded-lg bg-muted/60 p-3 sm:p-5">
        {/* keyed by slug so each template eases in instead of snapping */}
        <div key={template.slug} className="mx-auto max-w-[794px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
          <TemplateRenderer templateSlug={template.slug} data={data} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground" role="status">
        {usingSample
          ? "Your CV is still empty, so this preview uses sample content. Your own details will fill in as you add them."
          : "Previewing with your CV's current content. Nothing changes until you choose Use template."}
      </p>
    </div>
  );
}
