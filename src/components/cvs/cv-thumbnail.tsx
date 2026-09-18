import { FileTextIcon } from "lucide-react";
import { TemplateRenderer } from "@/components/cvs/templates/template-renderer";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { CvTemplate } from "@/lib/cvs/types";

const A4_WIDTH_PX = 794;
const THUMBNAIL_WIDTH_PX = 220;
const SCALE = THUMBNAIL_WIDTH_PX / A4_WIDTH_PX;

/**
 * reference/auth/cv-builder.png's per-card CV thumbnail — the user's own
 * saved CV, scaled down through the same `TemplateRenderer` the editor
 * preview and PDF export use, never a fabricated stock image. A CV with
 * no current version yet (shouldn't happen for a real row, but the type
 * allows it) falls back to a plain icon tile rather than pretending to
 * have content to show.
 */
export function CvThumbnail({ template, data }: { template: CvTemplate; data: CvTemplateContentData | null }) {
  return (
    <div className="relative aspect-[210/297] w-full overflow-hidden rounded-t-xl border-b bg-muted">
      {data ? (
        <div
          className="pointer-events-none absolute top-0 left-0 origin-top-left"
          style={{ width: A4_WIDTH_PX, transform: `scale(${SCALE})` }}
        >
          <TemplateRenderer templateSlug={template} data={data} />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <FileTextIcon className="size-8 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
