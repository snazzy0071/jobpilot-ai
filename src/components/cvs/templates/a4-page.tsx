"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// 210mm x 297mm at 96 CSS px/inch — the standard, universally-used
// reference size for rendering A4 documents in a browser.
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const MAX_PAGES = 2;

/**
 * Renders a template layout as real, separate A4 sheets — not one tall
 * rectangle with lines drawn across it. Each page is its own
 * `overflow: hidden` window at real A4 proportions, showing a
 * vertically-shifted slice of the same content (the standard CSS trick
 * for simulating pagination without a layout engine): page N's window
 * holds an identical copy of `children`, shifted up by `-N * a4Height`
 * before the shared scale transform is applied, so the same visual
 * content lines up seamlessly across the page-1/page-2 boundary instead
 * of just being annotated with a line.
 *
 * Page count is real DOM measurement (a ResizeObserver on page 1's own
 * content — its natural height is unaffected by the `overflow: hidden`
 * ancestor clipping it), not a guess — worded as an *estimate* since
 * real print/PDF pagination can still shift slightly by rendering
 * engine (no PDF export exists yet to paginate exactly against).
 *
 * Enforces the 2-page default in the preview itself: once content
 * exceeds 2 pages, only the first 2 render unless the user explicitly
 * asks to see the rest — nothing is deleted, this only affects what the
 * *preview* shows by default, matching what a real export would
 * eventually include.
 *
 * Every page is hardcoded to a white background and dark text
 * regardless of the app's theme — it represents a printed sheet, not a
 * themed UI surface, so it looks the same in light or dark mode.
 */
export function A4Page({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(A4_HEIGHT_PX);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? A4_WIDTH_PX;
      setScale(width > 0 ? Math.min(1, width / A4_WIDTH_PX) : 1);
    });
    observer.observe(wrapperEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const measureEl = measureRef.current;
    if (!measureEl) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? A4_HEIGHT_PX;
      setContentHeight(height);
    });
    observer.observe(measureEl);
    return () => observer.disconnect();
  }, []);

  const actualPageCount = Math.max(1, Math.ceil(contentHeight / A4_HEIGHT_PX));
  const overflowsDefault = actualPageCount > MAX_PAGES;
  const visiblePageCount = expanded ? actualPageCount : Math.min(actualPageCount, MAX_PAGES);
  const pageWindowWidth = A4_WIDTH_PX * scale;
  const pageWindowHeight = A4_HEIGHT_PX * scale;

  return (
    <div className="flex flex-col gap-3">
      {overflowsDefault && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          <span className="flex items-center gap-1.5">
            <AlertTriangleIcon className="size-3.5 shrink-0" />
            {expanded
              ? `Showing all ${actualPageCount} pages — over the 2-page default. Trim content to fit.`
              : `This CV is about ${actualPageCount} pages. Only the first ${MAX_PAGES} show by default.`}
          </span>
          <Button type="button" variant="ghost" size="xs" onClick={() => setExpanded((v) => !v)} className="shrink-0">
            {expanded ? (
              <>
                <ChevronUpIcon /> Show first {MAX_PAGES}
              </>
            ) : (
              <>
                <ChevronDownIcon /> Show all {actualPageCount}
              </>
            )}
          </Button>
        </div>
      )}

      <div ref={wrapperRef} className="flex w-full flex-col gap-4">
        {Array.from({ length: visiblePageCount }, (_, pageIndex) => pageIndex).map((pageIndex) => (
          <div
            key={pageIndex}
            className="relative overflow-hidden bg-white text-black shadow-md"
            style={{ width: pageWindowWidth, height: pageWindowHeight }}
          >
            <div style={{ width: A4_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <div ref={pageIndex === 0 ? measureRef : undefined} style={{ marginTop: -pageIndex * A4_HEIGHT_PX }}>
                {children}
              </div>
            </div>
            <span className="absolute right-2 bottom-1.5 text-[10px] text-neutral-400">Page {pageIndex + 1}</span>
          </div>
        ))}
      </div>

      {!overflowsDefault && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          <CheckIcon className="size-3.5" />
          Estimated to fit on {actualPageCount} {actualPageCount === 1 ? "page" : "pages"} (A4).
        </p>
      )}
    </div>
  );
}
