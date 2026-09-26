"use client";

import { useMemo, useState } from "react";
import { PaletteIcon } from "lucide-react";
import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { useTemplateLimit } from "@/components/cvs/templates/template-limit-context";
import { isTemplateAllowed } from "@/lib/cvs/template-access";
import { TemplateCard } from "@/components/cvs/templates/template-card";
import { TemplatePreviewPanel } from "@/components/cvs/templates/template-preview-panel";
import { CV_TEMPLATE_SAMPLE_DATA } from "@/components/cvs/templates/sample-data";
import type { CvTemplateContentData, CvTemplateExtras } from "@/components/cvs/templates/types";
import {
  CV_TEMPLATES,
  CV_TEMPLATE_CATEGORIES,
  CV_TEMPLATE_CATEGORY_LABELS,
  type CvTemplate,
  type CvTemplateCategory,
} from "@/config/cv-templates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALL = "all" as const;
type SidebarFilter = typeof ALL | "sidebar" | "no-sidebar";

const SIDEBAR_FILTER_LABELS: Record<SidebarFilter, string> = {
  all: "Any layout",
  sidebar: "With sidebar",
  "no-sidebar": "No sidebar",
};

const CATEGORY_HINTS: Record<CvTemplateCategory, string> = {
  graduate: "First roles, placements and graduate schemes",
  professional: "Established careers in most sectors",
  executive: "Director, partner and C-suite roles",
  technical: "Engineering, IT, data and science",
  finance: "Banking, accountancy and financial services",
  legal: "Law firms, chambers and in-house legal",
  consulting: "Consultancy, analysis and advisory work",
  healthcare: "NHS, clinical, care and health services",
  creative: "Design, media, marketing and communications",
  minimal: "Clean, quiet and content-first",
  classic: "Traditional, formal and familiar",
  modern: "Contemporary layouts with a confident edge",
};

/**
 * The template chooser. 24 designs, filterable by category (a template can
 * sit in several: Sovereign is Executive, Finance and Legal) and by
 * sidebar/no sidebar. Each card shows a real thumbnail, name, style, an
 * ATS-safe badge, who it's recommended for, a **Preview** (a full-size,
 * live render of the template with the user's own CV content — nothing is
 * applied) and **Use template**.
 *
 * Choosing a template is live: `setLiveTemplate` updates
 * `CvPreviewProvider` immediately (the editor's preview re-renders before
 * the persist call resolves), then `updateCvTemplate` saves it for real.
 * Card thumbnails use a fixed, deliberately full sample CV so all 24 are
 * the same size and rendering them at once stays cheap; only the Preview
 * view renders the user's own content.
 */
export function TemplatePickerDialog({
  currentTemplate,
  content,
  triggerLabel = "Change template",
  triggerVariant = "outline",
}: {
  currentTemplate: CvTemplate;
  /** Skills, projects, etc. — so Preview can show the whole CV. Without it the preview falls back to sample content. */
  content?: CvTemplateExtras;
  triggerLabel?: string;
  triggerVariant?: "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CvTemplateCategory | typeof ALL>(ALL);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(ALL);
  const [previewSlug, setPreviewSlug] = useState<CvTemplate | null>(null);
  const { preview, selectTemplate: selectLiveTemplate } = useCvPreview();
  const templateLimit = useTemplateLimit();
  // The live template, so the ring and check move the instant a choice is made rather than after the save round trip.
  const activeTemplate = preview.template || currentTemplate;

  const categoryCounts = useMemo(() => {
    const counts = new Map<CvTemplateCategory, number>();
    for (const category of CV_TEMPLATE_CATEGORIES) {
      counts.set(category, CV_TEMPLATES.filter((t) => t.categories.includes(category)).length);
    }
    return counts;
  }, []);

  const filtered = useMemo(
    () =>
      CV_TEMPLATES.filter((t) => {
        const hasSidebar = t.layout === "sidebar-left" || t.layout === "sidebar-right";
        return (
          (category === ALL || t.categories.includes(category)) &&
          (sidebarFilter === ALL || (sidebarFilter === "sidebar") === hasSidebar)
        );
      }),
    [category, sidebarFilter],
  );

  const hasFilters = category !== ALL || sidebarFilter !== ALL;

  // The user's own CV, as it stands right now (live-typed fields overlaid), or sample content while it's still empty.
  const hasOwnContent = Boolean(content && preview.personal?.fullName?.trim());
  const previewData: CvTemplateContentData = useMemo(
    () =>
      content && hasOwnContent
        ? {
            personal: preview.personal,
            summary: preview.summary,
            experience: preview.experience,
            education: preview.education,
            ...content,
          }
        : CV_TEMPLATE_SAMPLE_DATA,
    [content, hasOwnContent, preview.personal, preview.summary, preview.experience, preview.education],
  );

  // Arrows step through what the user is currently browsing; a template opened from outside the filter falls back to the whole catalog.
  const browsable = previewSlug && !filtered.some((t) => t.slug === previewSlug) ? CV_TEMPLATES : filtered;
  const previewIndex = previewSlug ? browsable.findIndex((t) => t.slug === previewSlug) : -1;
  const previewTemplate = previewIndex >= 0 ? browsable[previewIndex] : null;

  function clearFilters() {
    setCategory(ALL);
    setSidebarFilter(ALL);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setPreviewSlug(null);
  }

  function selectTemplate(slug: CvTemplate) {
    // Optimistic + persisted + reverted-on-failure all live in the preview provider, so this dialog holds no
    // template state of its own and a failed save is reported in the editor header rather than dropped.
    selectLiveTemplate(slug);
    handleOpenChange(false);
  }

  function step(direction: -1 | 1) {
    if (previewIndex < 0) return;
    const next = browsable[(previewIndex + direction + browsable.length) % browsable.length];
    setPreviewSlug(next.slug);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant={triggerVariant} size="sm">
            <PaletteIcon /> {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-6xl">
        {previewTemplate ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Preview {previewTemplate.name}</DialogTitle>
              <DialogDescription>A full-size preview of this template with your CV content.</DialogDescription>
            </DialogHeader>
            <TemplatePreviewPanel
              template={previewTemplate}
              data={previewData}
              usingSample={!hasOwnContent}
              current={previewTemplate.slug === activeTemplate}
              locked={previewTemplate.slug !== activeTemplate && !isTemplateAllowed(previewTemplate.slug, templateLimit)}
              position={previewIndex + 1}
              total={browsable.length}
              onBack={() => setPreviewSlug(null)}
              onStep={step}
              onUse={() => selectTemplate(previewTemplate.slug)}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Choose a template</DialogTitle>
              <DialogDescription>
                24 original, ATS-friendly UK designs. Preview any of them with your own CV before you use it.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter templates by category">
              <Button
                type="button"
                size="xs"
                variant={category === ALL ? "default" : "outline"}
                aria-pressed={category === ALL}
                onClick={() => setCategory(ALL)}
                className="transition-colors duration-150"
              >
                All <span className="opacity-70">{CV_TEMPLATES.length}</span>
              </Button>
              {CV_TEMPLATE_CATEGORIES.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="xs"
                  variant={category === value ? "default" : "outline"}
                  aria-pressed={category === value}
                  title={CATEGORY_HINTS[value]}
                  onClick={() => setCategory(value)}
                  className="transition-colors duration-150"
                >
                  {CV_TEMPLATE_CATEGORY_LABELS[value]} <span className="opacity-70">{categoryCounts.get(value)}</span>
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Select value={sidebarFilter} onValueChange={(value) => setSidebarFilter((value ?? ALL) as SidebarFilter)}>
                <SelectTrigger className="w-44" aria-label="Filter by layout">
                  <SelectValue placeholder="Any layout">{SIDEBAR_FILTER_LABELS[sidebarFilter]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SIDEBAR_FILTER_LABELS) as SidebarFilter[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {SIDEBAR_FILTER_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {category !== ALL && <p className="text-xs text-muted-foreground">{CATEGORY_HINTS[category]}</p>}

              {hasFilters && (
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}

              <p className="ml-auto text-xs text-muted-foreground" role="status">
                {filtered.length} of {CV_TEMPLATES.length} templates
              </p>
            </div>

            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No templates match those filters. Try clearing one.</p>
            ) : (
              <ul
                key={`${category}-${sidebarFilter}`}
                className={cn(
                  "grid max-h-[62vh] grid-cols-1 gap-4 overflow-y-auto p-1 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
                  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300",
                )}
              >
                {filtered.map((t) => (
                  <TemplateCard
                    key={t.slug}
                    template={t}
                    current={t.slug === activeTemplate}
                    onPreview={() => setPreviewSlug(t.slug)}
                    locked={t.slug !== activeTemplate && !isTemplateAllowed(t.slug, templateLimit)}
                    onUse={() => selectTemplate(t.slug)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
