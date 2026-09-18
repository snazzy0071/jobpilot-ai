"use client";

import { useMemo, useState } from "react";
import { PaletteIcon } from "lucide-react";
import { updateCvTemplate } from "@/lib/cvs/actions";
import { callAction } from "@/components/cvs/editor/call-action";
import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { TemplateRenderer } from "@/components/cvs/templates/template-renderer";
import { CV_TEMPLATE_SAMPLE_DATA } from "@/components/cvs/templates/sample-data";
import {
  CV_TEMPLATES,
  CV_TEMPLATE_SECTORS,
  CV_TEMPLATE_SECTOR_LABELS,
  CV_TEMPLATE_EXPERIENCE_LEVELS,
  CV_TEMPLATE_EXPERIENCE_LEVEL_LABELS,
  type CvTemplate,
  type CvTemplateSector,
  type CvTemplateExperienceLevel,
} from "@/config/cv-templates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all" as const;

/**
 * The template picker — 24 templates, filterable by sector and
 * experience level, with live switching: clicking a card updates
 * `CvPreviewProvider`'s live template immediately (the editor's preview
 * panel re-renders before the persist call below even resolves), then
 * `updateCvTemplate` saves the choice for real. Thumbnails render a
 * fixed, deliberately concise sample CV (not the user's own — see
 * src/components/cvs/templates/sample-data.ts) rather than their actual
 * content, so all 24 thumbnails stay a consistent size regardless of how
 * long a real CV is, and rendering 24 of them at once stays cheap.
 */
export function TemplatePickerDialog({
  cvId,
  currentTemplate,
  triggerLabel = "Change template",
  triggerVariant = "outline",
}: {
  cvId: string;
  currentTemplate: CvTemplate;
  triggerLabel?: string;
  triggerVariant?: "outline" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<CvTemplateSector | typeof ALL>(ALL);
  const [experienceFilter, setExperienceFilter] = useState<CvTemplateExperienceLevel | typeof ALL>(ALL);
  const { setLiveTemplate } = useCvPreview();

  const filtered = useMemo(
    () =>
      CV_TEMPLATES.filter(
        (t) =>
          (sectorFilter === ALL || t.sectors.includes(sectorFilter)) &&
          (experienceFilter === ALL || t.experienceLevels.includes(experienceFilter)),
      ),
    [sectorFilter, experienceFilter],
  );

  function selectTemplate(slug: CvTemplate) {
    setLiveTemplate(slug);
    setOpen(false);
    const formData = new FormData();
    formData.set("cvId", cvId);
    formData.set("template", slug);
    void callAction(() => updateCvTemplate(undefined, formData));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant={triggerVariant} size="sm">
            <PaletteIcon /> {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            24 original, UK ATS-safe templates — A4, max 2 pages, no photo. Selecting one updates your preview
            immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={sectorFilter} onValueChange={(value) => setSectorFilter((value ?? ALL) as CvTemplateSector | typeof ALL)}>
            <SelectTrigger className="w-56" aria-label="Filter by sector">
              <SelectValue placeholder="All sectors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sectors</SelectItem>
              {CV_TEMPLATE_SECTORS.map((sector) => (
                <SelectItem key={sector} value={sector}>
                  {CV_TEMPLATE_SECTOR_LABELS[sector]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={experienceFilter}
            onValueChange={(value) => setExperienceFilter((value ?? ALL) as CvTemplateExperienceLevel | typeof ALL)}
          >
            <SelectTrigger className="w-56" aria-label="Filter by experience level">
              <SelectValue placeholder="All experience levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All experience levels</SelectItem>
              {CV_TEMPLATE_EXPERIENCE_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {CV_TEMPLATE_EXPERIENCE_LEVEL_LABELS[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(sectorFilter !== ALL || experienceFilter !== ALL) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSectorFilter(ALL);
                setExperienceFilter(ALL);
              }}
            >
              Clear filters
            </Button>
          )}

          <p className="ml-auto text-xs text-muted-foreground">
            {filtered.length} of {CV_TEMPLATES.length} templates
          </p>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No templates match those filters — try clearing one.
          </p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {filtered.map((t) => (
              <button
                key={t.slug}
                type="button"
                onClick={() => selectTemplate(t.slug)}
                className={`flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                  t.slug === currentTemplate ? "border-primary ring-1 ring-primary" : ""
                }`}
              >
                <div className="h-36 overflow-hidden rounded border bg-muted">
                  <div style={{ width: 794, transform: "scale(0.17)", transformOrigin: "top left" }}>
                    <TemplateRenderer templateSlug={t.slug} data={CV_TEMPLATE_SAMPLE_DATA} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium">{t.name}</p>
                    {t.slug === currentTemplate && (
                      <Badge variant="secondary" className="text-[10px] font-normal">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="line-clamp-2 text-[10px] text-muted-foreground">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
