import { getCvTemplate } from "@/config/cv-templates";
import { THEME_STYLES } from "@/components/cvs/templates/theme-styles";
import { A4Page } from "@/components/cvs/templates/a4-page";
import { SingleColumnLayout } from "@/components/cvs/templates/layouts/single-column-layout";
import { SidebarLayout } from "@/components/cvs/templates/layouts/sidebar-layout";
import { HeaderBandLayout } from "@/components/cvs/templates/layouts/header-band-layout";
import { CompactLayout } from "@/components/cvs/templates/layouts/compact-layout";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { CvTemplateLayout } from "@/config/cv-templates";

const LAYOUT_COMPONENTS: Record<CvTemplateLayout, typeof SingleColumnLayout> = {
  single: SingleColumnLayout,
  sidebar: SidebarLayout,
  band: HeaderBandLayout,
  compact: CompactLayout,
};

/**
 * The single entry point for rendering a CV through one of the 24
 * templates — resolves the slug to its layout+theme (falling back to
 * the first template for an unrecognised slug, same as
 * `getCvTemplate`), and renders the same `Layout`/`theme`/content-block
 * tree regardless of `mode`, which is the actual mechanism keeping the
 * preview and the PDF export visually consistent: they're never two
 * separate implementations of "what a template looks like".
 *
 * `mode: "screen"` (default) — used by the editor's live preview and
 * the template-picker's thumbnails — wraps the layout in `A4Page`'s
 * JS-driven page-slicing/scaling for an on-screen approximation.
 *
 * `mode: "print"` — used only by the server-rendered print route
 * (`src/app/print/cvs/[cvId]/page.tsx`) that Puppeteer captures for PDF
 * export — skips `A4Page` entirely and renders the layout directly
 * inside real `@page`-sized CSS (see that route's print stylesheet), so
 * pagination comes from Chromium's actual print engine instead of the
 * screen's approximation. More accurate, not less consistent: the same
 * layout/theme/content produces the pagination a real printer or PDF
 * viewer would actually give it.
 */
export function TemplateRenderer({
  templateSlug,
  data,
  mode = "screen",
}: {
  templateSlug: string;
  data: CvTemplateContentData;
  mode?: "screen" | "print";
}) {
  const definition = getCvTemplate(templateSlug);
  const theme = THEME_STYLES[definition.theme];
  const Layout = LAYOUT_COMPONENTS[definition.layout];

  if (mode === "print") {
    return (
      <div className="pdf-export bg-white text-black">
        <Layout data={data} theme={theme} />
      </div>
    );
  }

  return (
    <A4Page>
      <Layout data={data} theme={theme} />
    </A4Page>
  );
}
