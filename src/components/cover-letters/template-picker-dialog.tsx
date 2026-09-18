"use client";

import { useState } from "react";
import { PaletteIcon } from "lucide-react";
import { updateCoverLetterTemplate } from "@/lib/cover-letters/actions";
import { callAction } from "@/components/cvs/editor/call-action";
import { useCoverLetterPreview } from "@/components/cover-letters/editor-preview-context";
import { CoverLetterTemplateRenderer } from "@/components/cover-letters/templates/template-renderer";
import { COVER_LETTER_SAMPLE_DATA } from "@/components/cover-letters/templates/sample-data";
import { COVER_LETTER_TEMPLATES, type CoverLetterTemplate } from "@/config/cover-letter-templates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * The 4-template picker — live switching, same pattern as CVs'
 * TemplatePickerDialog: clicking a card updates
 * CoverLetterPreviewProvider's live template immediately (the preview
 * panel re-renders before the persist call below even resolves), then
 * updateCoverLetterTemplate saves the choice for real. Thumbnails render
 * a fixed sample letter (src/components/cover-letters/templates/
 * sample-data.ts), not the user's own content, so all 4 stay a
 * consistent size regardless of how long a real letter is. No sector/
 * level filters — with only 4 templates a picker grid needs none of the
 * CV picker's filter UI.
 */
export function CoverLetterTemplatePickerDialog({
  coverLetterId,
  currentTemplate,
}: {
  coverLetterId: string;
  currentTemplate: CoverLetterTemplate;
}) {
  const [open, setOpen] = useState(false);
  const { setLiveTemplate } = useCoverLetterPreview();

  function selectTemplate(slug: CoverLetterTemplate) {
    setLiveTemplate(slug);
    setOpen(false);
    const formData = new FormData();
    formData.set("coverLetterId", coverLetterId);
    formData.set("template", slug);
    void callAction(() => updateCoverLetterTemplate(undefined, formData));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <PaletteIcon /> Change template
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
          <DialogDescription>
            4 original templates — A4, one page. Selecting one updates your preview immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {COVER_LETTER_TEMPLATES.map((template) => (
            <button
              key={template.slug}
              type="button"
              onClick={() => selectTemplate(template.slug)}
              className={`flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                template.slug === currentTemplate ? "border-primary ring-1 ring-primary" : ""
              }`}
            >
              <div className="h-40 overflow-hidden rounded border bg-muted">
                <div style={{ width: 794, transform: "scale(0.19)", transformOrigin: "top left" }}>
                  <CoverLetterTemplateRenderer templateSlug={template.slug} data={COVER_LETTER_SAMPLE_DATA} />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium">{template.name}</p>
                  {template.slug === currentTemplate && (
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="line-clamp-2 text-[10px] text-muted-foreground">{template.description}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
