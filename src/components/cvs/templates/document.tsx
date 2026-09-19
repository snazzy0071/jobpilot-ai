import { Fragment, type CSSProperties } from "react";
import { sectionHasContent } from "@/components/cvs/templates/content";
import { CvHeader } from "@/components/cvs/templates/header";
import { mainTone, sidebarTone, fontOf, type Ctx } from "@/components/cvs/templates/primitives";
import { renderSection } from "@/components/cvs/templates/sections";
import { PAGE_PAD_Y, PAGE_WIDTH, type TemplateDesign } from "@/components/cvs/templates/design";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { SectionKey } from "@/lib/cvs/types";

/**
 * The page-wide gradient that paints a sidebar column edge to edge on
 * every page (a solid fill, or a hairline at the column edge). It lives on
 * the page rather than on the sidebar element so the column keeps its full
 * height on page 2 as well — the sidebar's own box only reaches as far as
 * its content.
 */
export function pageBackgroundImage(design: TemplateDesign): string | undefined {
  const side = design.sidebar;
  if (!side) return undefined;
  const direction = design.frame === "sidebar-right" ? "to left" : "to right";
  const w = side.width;
  if (side.edge === "line") {
    return `linear-gradient(${direction}, transparent ${w - 1}px, ${side.rule} ${w - 1}px, ${side.rule} ${w}px, transparent ${w}px)`;
  }
  return `linear-gradient(${direction}, ${side.bg} 0, ${side.bg} ${w}px, transparent ${w}px)`;
}

/**
 * Print-only twin of pageBackgroundImage: a solid, fixed-position column.
 * Chromium repeats fixed elements on every printed page, so the sidebar
 * runs the full height of each page — and unlike a CSS gradient (which
 * Chromium writes as a PDF shading that pdf.js-based viewers such as
 * Firefox's paint hot pink), it is a plain filled rectangle every PDF
 * reader draws identically.
 */
function PrintSidebarBackdrop({ design }: { design: TemplateDesign }) {
  const side = design.sidebar;
  if (!side) return null;
  const left = design.frame === "sidebar-left";
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        [left ? "left" : "right"]: 0,
        width: side.width,
        boxSizing: "border-box",
        zIndex: -1,
        ...(side.edge === "fill"
          ? { backgroundColor: side.bg }
          : left
            ? { borderRight: `1px solid ${side.rule}` }
            : { borderLeft: `1px solid ${side.rule}` }),
      }}
    />
  );
}

function bodySections(data: CvTemplateContentData): SectionKey[] {
  return data.sectionOrder.filter((key) => key !== "personal" && sectionHasContent(key, data));
}

function SectionColumn({
  keys,
  data,
  ctx,
  placement,
}: {
  keys: SectionKey[];
  data: CvTemplateContentData;
  ctx: Ctx;
  placement: "stack" | "gutter";
}) {
  return (
    <>
      {keys.map((key, index) => (
        <Fragment key={key}>{renderSection(key, data, ctx, { first: index === 0, placement })}</Fragment>
      ))}
    </>
  );
}

function Frame({ data, design }: { data: CvTemplateContentData; design: TemplateDesign }) {
  const keys = bodySections(data);
  const main: Ctx = { design, tone: mainTone(design) };

  if (design.sidebar && (design.frame === "sidebar-left" || design.frame === "sidebar-right")) {
    const side = design.sidebar;
    const left = design.frame === "sidebar-left";
    const sideKeys = keys.filter((key) => side.sections.includes(key));
    const mainKeys = keys.filter((key) => !side.sections.includes(key));

    // DOM order is header → main column → sidebar (a sensible linear read for any
    // parser); explicit grid placement puts the sidebar on its visual side.
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: left ? `${side.width}px minmax(0, 1fr)` : `minmax(0, 1fr) ${side.width}px`,
          alignItems: "start",
        }}
      >
        <div style={{ gridColumn: left ? 2 : 1, gridRow: 1, minWidth: 0 }}>
          <CvHeader data={data} design={design} padX={design.padX} />
          <div style={{ padding: `0 ${design.padX}px` }}>
            <SectionColumn keys={mainKeys} data={data} ctx={main} placement="stack" />
          </div>
        </div>
        <div style={{ gridColumn: left ? 1 : 2, gridRow: 1, minWidth: 0, padding: `0 ${side.padX}px` }}>
          <SectionColumn keys={sideKeys} data={data} ctx={{ design, tone: sidebarTone(design) }} placement="stack" />
        </div>
      </div>
    );
  }

  return (
    <>
      <CvHeader data={data} design={design} padX={design.padX} />
      <div style={{ padding: `0 ${design.padX}px` }}>
        <SectionColumn keys={keys} data={data} ctx={main} placement={design.frame === "gutter" ? "gutter" : "stack"} />
      </div>
    </>
  );
}

/**
 * One CV, laid out on a page-wide canvas.
 *
 * "print" — the real document Chromium paginates: `@page` margin is 0, so
 * `box-decoration-break: clone` re-applies the top/bottom padding on every
 * page it flows onto, and a fixed backdrop repeats the sidebar column.
 *
 * "flow" — the same tree without background or bottom padding, for the
 * on-screen paginator, which slices it into A4 sheets and paints the
 * background on each sheet itself.
 */
export function CvDocument({ data, design, mode }: { data: CvTemplateContentData; design: TemplateDesign; mode: "print" | "flow" }) {
  const style: CSSProperties = {
    boxSizing: "border-box",
    width: mode === "print" ? "100%" : PAGE_WIDTH,
    paddingTop: PAGE_PAD_Y,
    paddingBottom: mode === "print" ? PAGE_PAD_Y : 0,
    color: design.colors.ink,
    fontFamily: fontOf(design, "body"),
    fontSize: design.type.base,
    lineHeight: design.type.lineHeight,
    fontVariantLigatures: "none",
    overflowWrap: "break-word",
    ...(mode === "print"
      ? {
          backgroundColor: "#ffffff",
          isolation: "isolate",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }
      : null),
  };

  return (
    <div className="cv-document" style={style}>
      {mode === "print" && <PrintSidebarBackdrop design={design} />}
      <Frame data={data} design={design} />
    </div>
  );
}
