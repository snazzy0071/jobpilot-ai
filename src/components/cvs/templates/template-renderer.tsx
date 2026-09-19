import { A4Page } from "@/components/cvs/templates/a4-page";
import { CvDocument, pageBackgroundImage } from "@/components/cvs/templates/document";
import { getTemplateDesign } from "@/components/cvs/templates/designs";
import { getCvTemplate } from "@/config/cv-templates";
import { CV_FONT_CLASS_NAMES } from "@/components/cvs/templates/fonts";
import { PAGE_PAD_Y } from "@/components/cvs/templates/design";
import { TemplateThumbnailFrame } from "@/components/cvs/templates/thumbnail-frame";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

/**
 * The single entry point for rendering a CV through one of the 24
 * templates. The same `CvDocument` tree — same design tokens, same
 * sections, same markup — renders in every mode, which is what keeps the
 * preview, the thumbnails and the PDF export visually consistent: they
 * are never separate implementations of "what a template looks like".
 *
 * - `screen` (default): the editor's live preview. `A4Page` measures the
 *   document and shows it as real A4 sheets, breaking pages by the same
 *   rules the print stylesheet gives Chromium.
 * - `thumbnail`: page one only, scaled to its container, no measuring —
 *   for the template gallery and the CV list cards.
 * - `print`: used only by the server-rendered print route that Puppeteer
 *   captures. No JS pagination: the document is laid out at true page
 *   width with `@page { margin: 0 }` and Chromium's own print engine
 *   paginates it.
 */
export function TemplateRenderer({
  templateSlug,
  data,
  mode = "screen",
}: {
  templateSlug: string;
  data: CvTemplateContentData;
  mode?: "screen" | "print" | "thumbnail";
}) {
  const design = getTemplateDesign(templateSlug);
  // The catalog slug this render actually used (an unknown/legacy value is resolved, not guessed at). Exposed in the
  // DOM so preview, thumbnails and print can be checked against what the editor thinks is selected.
  const resolvedSlug = getCvTemplate(templateSlug).slug;
  const backgroundImage = pageBackgroundImage(design);

  if (mode === "print") {
    return (
      <div className={CV_FONT_CLASS_NAMES} data-cv-template={resolvedSlug}>
        <CvDocument data={data} design={design} mode="print" />
      </div>
    );
  }

  if (mode === "thumbnail") {
    return (
      <TemplateThumbnailFrame backgroundImage={backgroundImage}>
        <div className={CV_FONT_CLASS_NAMES} data-cv-template={resolvedSlug}>
          <CvDocument data={data} design={design} mode="flow" />
        </div>
      </TemplateThumbnailFrame>
    );
  }

  return (
    <div className={CV_FONT_CLASS_NAMES} data-cv-template={resolvedSlug}>
      <A4Page backgroundImage={backgroundImage} padY={PAGE_PAD_Y}>
        <CvDocument data={data} design={design} mode="flow" />
      </A4Page>
    </div>
  );
}
