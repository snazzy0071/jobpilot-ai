"use client";

import { CheckIcon, EyeIcon, LockIcon, ShieldCheckIcon } from "lucide-react";
import { TemplateRenderer } from "@/components/cvs/templates/template-renderer";
import { CV_TEMPLATE_SAMPLE_DATA } from "@/components/cvs/templates/sample-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CV_TEMPLATE_CATEGORY_LABELS,
  CV_TEMPLATE_LAYOUT_LABELS,
  CV_TEMPLATE_STYLE_LABELS,
  type CvTemplateDefinition,
} from "@/config/cv-templates";

/** Every design ships real text, no images or tables, and a linear reading order — the badge says so on every card, and its title says why. */
export const ATS_SAFE_HINT =
  "Real selectable text, no images or tables, and a linear reading order that applicant tracking systems parse correctly.";

export function AtsSafeBadge({ className }: { className?: string }) {
  return (
    <Badge variant="tinted" title={ATS_SAFE_HINT} className={className}>
      <ShieldCheckIcon aria-hidden /> ATS-safe
    </Badge>
  );
}

/**
 * One template in the chooser grid. The thumbnail is page one of the real
 * template rendering a full sample CV (identical size on every card). The
 * card lifts and its thumbnail eases in on hover/focus; the current
 * template gets a ring and a check that pops in. All motion is behind
 * `motion-safe:` so it's dropped for anyone who asks for reduced motion.
 */
export function TemplateCard({
  template,
  current,
  locked = false,
  onPreview,
  onUse,
}: {
  template: CvTemplateDefinition;
  current: boolean;
  /** Not included in the person's plan: it can be previewed but not chosen. */
  locked?: boolean;
  onPreview: () => void;
  onUse: () => void;
}) {
  return (
    <li className="min-w-0">
      <div
        className={cn(
          "group/card relative flex h-full flex-col gap-3 rounded-xl border bg-card p-2 transition-all duration-200 ease-out",
          "hover:border-primary/60 hover:shadow-lg focus-within:border-primary/60 focus-within:shadow-lg motion-safe:hover:-translate-y-1 motion-safe:focus-within:-translate-y-1",
          current && "border-primary shadow-md ring-2 ring-primary/40",
        )}
      >
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview the ${template.name} template with your CV`}
          className="relative block overflow-hidden rounded-md border bg-white text-left shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="origin-top transition-transform duration-300 ease-out motion-safe:group-hover/card:scale-[1.035] motion-safe:group-focus-within/card:scale-[1.035]">
            <TemplateRenderer templateSlug={template.slug} data={CV_TEMPLATE_SAMPLE_DATA} mode="thumbnail" />
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pt-8 pb-2 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 group-focus-within/card:opacity-100"
          >
            <EyeIcon className="size-3.5" /> Preview with your CV
          </span>
          {current && (
            <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300">
              <CheckIcon className="size-3.5" aria-hidden />
              <span className="sr-only">Current template</span>
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading text-sm font-semibold">{template.name}</p>
            <AtsSafeBadge className="shrink-0" />
          </div>
          <p className="text-xs font-medium text-primary">
            {CV_TEMPLATE_STYLE_LABELS[template.style]} · {CV_TEMPLATE_LAYOUT_LABELS[template.layout]}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">Best for: </span>
            {template.recommendedFor}
          </p>
          <ul className="flex flex-wrap gap-1 pt-0.5" aria-label="Categories">
            {template.categories.map((category) => (
              <li key={category} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {CV_TEMPLATE_CATEGORY_LABELS[category]}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2 px-1 pb-1">
          <Button type="button" variant="outline" size="sm" onClick={onPreview} aria-label={`Preview ${template.name}`}>
            <EyeIcon /> Preview
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onUse}
            disabled={current || locked}
            aria-label={current ? `${template.name} is your current template` : locked ? `${template.name} needs a paid plan` : `Use the ${template.name} template`}
          >
            {current ? (
              <>
                <CheckIcon /> In use
              </>
            ) : locked ? (
              <>
                <LockIcon /> Paid plan
              </>
            ) : (
              "Use template"
            )}
          </Button>
        </div>
      </div>
    </li>
  );
}
