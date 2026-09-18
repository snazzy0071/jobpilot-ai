import { A4Page } from "@/components/cvs/templates/a4-page";
import { ClassicSerifLayout } from "@/components/cover-letters/templates/layouts/classic-serif";
import { ModernBlockLayout } from "@/components/cover-letters/templates/layouts/modern-block";
import { MinimalCleanLayout } from "@/components/cover-letters/templates/layouts/minimal-clean";
import { BoldHeaderLayout } from "@/components/cover-letters/templates/layouts/bold-header";
import type { CoverLetterTemplate } from "@/config/cover-letter-templates";
import type { CoverLetterTemplateContentData } from "@/components/cover-letters/templates/types";

const LAYOUT_COMPONENTS: Record<CoverLetterTemplate, (props: { data: CoverLetterTemplateContentData }) => React.ReactElement> = {
  "classic-serif": ClassicSerifLayout,
  "modern-block": ModernBlockLayout,
  "minimal-clean": MinimalCleanLayout,
  "bold-header": BoldHeaderLayout,
};

/**
 * Picks the real template component for `templateSlug` and renders it
 * either as a live, shrink-to-fit A4 preview (`mode: "screen"`, reusing
 * A4Page from the CV template engine unchanged — it's fully generic on
 * `children`) or as real A4-sized content for Puppeteer's print engine
 * (`mode: "print"`) — same split as CVs' TemplateRenderer. The
 * `.pdf-export` class in print mode is what the print route's font-
 * override CSS (Georgia/Arial replacing the on-screen webfont) targets.
 */
export function CoverLetterTemplateRenderer({
  templateSlug,
  data,
  mode = "screen",
}: {
  templateSlug: string;
  data: CoverLetterTemplateContentData;
  mode?: "screen" | "print";
}) {
  const Layout = LAYOUT_COMPONENTS[templateSlug as CoverLetterTemplate] ?? ClassicSerifLayout;

  if (mode === "print") {
    return (
      <div className="pdf-export bg-white text-black">
        <Layout data={data} />
      </div>
    );
  }

  return (
    <A4Page>
      <Layout data={data} />
    </A4Page>
  );
}
