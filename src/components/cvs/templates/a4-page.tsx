"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangleIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_PAGES, PAGE_HEIGHT, PAGE_WIDTH } from "@/components/cvs/templates/design";

type Atom = { top: number; bottom: number; left: number; keep: boolean };

/**
 * Where each page starts, in the content's own coordinates (0 = top of the
 * document wrapper, whose padding-top is `padY`). Mirrors what
 * Chromium does when it prints the same markup: every `[data-cv-atom]` is
 * `break-inside: avoid`, atoms flagged `data-cv-keep` also
 * `break-after: avoid`, and continuation pages get `padY` of padding
 * top and bottom. A page therefore ends before the first atom that would
 * cross its bottom edge (pulled back further if that atom is preceded by a
 * "keep with next" heading), and the next page starts at that atom.
 */
export function computePageStarts(atoms: Atom[], contentHeight: number, padY: number): number[] {
  const starts = [0];
  let start = 0;

  for (let page = 0; page < 12; page++) {
    const limit = start + (page === 0 ? PAGE_HEIGHT - padY : PAGE_HEIGHT - 2 * padY);
    if (contentHeight <= limit + 0.5) break;

    const beyond = atoms.filter((atom) => atom.bottom > limit + 0.5 && atom.top > start + 0.5);
    let breakAt = limit;

    if (beyond.length > 0) {
      let candidate = beyond.reduce((first, atom) => (atom.top < first.top ? atom : first));
      // Never leave a heading / entry title stranded at the foot of a page.
      for (;;) {
        const previous = atoms
          .filter(
            (atom) =>
              atom.keep &&
              atom !== candidate &&
              atom.top > start + 0.5 &&
              atom.bottom <= candidate.top + 2 &&
              candidate.top - atom.bottom < 40 &&
              Math.abs(atom.left - candidate.left) < 12,
          )
          .sort((a, b) => b.bottom - a.bottom)[0];
        if (!previous) break;
        candidate = previous;
      }
      // An atom taller than a whole page can't be kept together — slice it instead.
      if (candidate.top > start + 24) breakAt = candidate.top;
    }

    starts.push(breakAt);
    start = breakAt;
  }

  return starts;
}

function sameStarts(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 0.5);
}

/**
 * Renders a template as real, separate A4 sheets. The document is
 * measured once; `computePageStarts` decides where each page begins (the
 * same rules the print stylesheet gives Chromium), and each sheet shows a
 * window onto the content starting there — content is never cut mid-line.
 * Every sheet paints the template's own page background (sidebar column),
 * so a sidebar runs the full height of page 2 just as it does in the PDF.
 *
 * Page count is a real measurement, not a guess. Only the first two pages
 * show by default — a CV should fit on two — with an explicit control to
 * see the rest; nothing is deleted.
 *
 * Every sheet is hardcoded white with dark text regardless of the app's
 * theme: it represents a printed page, not a themed surface.
 */
export function A4Page({
  children,
  backgroundImage,
  padY = 0,
}: {
  children: ReactNode;
  backgroundImage?: string;
  /** Vertical breathing space kept above and below the content on every page — the CV document reserves the same amount in print. Cover letters carry their own padding and pass 0. */
  padY?: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [starts, setStarts] = useState<number[]>([0]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? PAGE_WIDTH;
      setScale(width > 0 ? Math.min(1, width / PAGE_WIDTH) : 1);
    });
    observer.observe(wrapperEl);
    return () => observer.disconnect();
  }, []);

  const measure = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const ratio = rootRect.width / PAGE_WIDTH || 1;
    const atoms: Atom[] = [...root.querySelectorAll<HTMLElement>("[data-cv-atom]")]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          top: (rect.top - rootRect.top) / ratio,
          bottom: (rect.bottom - rootRect.top) / ratio,
          left: (rect.left - rootRect.left) / ratio,
          keep: el.hasAttribute("data-cv-keep"),
        };
      })
      .filter((atom) => atom.bottom - atom.top > 0);
    const next = computePageStarts(atoms, rootRect.height / ratio, padY);
    setStarts((current) => (sameStarts(current, next) ? current : next));
  }, [padY]);

  useEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(root);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
    const fonts = document.fonts;
    void fonts?.ready.then(schedule);
    fonts?.addEventListener("loadingdone", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      fonts?.removeEventListener("loadingdone", schedule);
    };
  }, [measure]);

  const actualPageCount = starts.length;
  const overflowsDefault = actualPageCount > MAX_PAGES;
  const visiblePageCount = expanded ? actualPageCount : Math.min(actualPageCount, MAX_PAGES);

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
              : `This CV runs to ${actualPageCount} pages. Only the first ${MAX_PAGES} show by default.`}
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
        {Array.from({ length: visiblePageCount }, (_, pageIndex) => pageIndex).map((pageIndex) => {
          const first = pageIndex === 0;
          const windowTop = first ? 0 : padY;
          const capacity = first ? PAGE_HEIGHT - padY : PAGE_HEIGHT - 2 * padY;
          // Show only up to where the next page starts — anything below the break belongs to that page, not this one.
          const nextStart = starts[pageIndex + 1];
          const windowHeight = nextStart === undefined ? capacity : Math.min(capacity, nextStart - starts[pageIndex]);
          const shift = first ? 0 : -(starts[pageIndex] ?? 0);
          return (
            <div
              key={pageIndex}
              className="relative overflow-hidden bg-white text-black shadow-md"
              style={{ width: PAGE_WIDTH * scale, height: PAGE_HEIGHT * scale }}
              // Every page after the first holds a duplicate of the document — keep it out of the tab order and the accessibility tree.
              inert={!first}
              aria-hidden={!first || undefined}
            >
              <div
                style={{
                  position: "relative",
                  width: PAGE_WIDTH,
                  height: PAGE_HEIGHT,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  backgroundColor: "#ffffff",
                  backgroundImage,
                }}
              >
                <div style={{ position: "absolute", top: windowTop, left: 0, width: PAGE_WIDTH, height: windowHeight, overflow: "hidden" }}>
                  <div ref={first ? measureRef : undefined} style={{ transform: shift ? `translateY(${shift}px)` : undefined }}>
                    {children}
                  </div>
                </div>
              </div>
              <span className="absolute right-2 bottom-1.5 text-[10px] text-neutral-400">Page {pageIndex + 1}</span>
            </div>
          );
        })}
      </div>

      {!overflowsDefault && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          <CheckIcon className="size-3.5" />
          Fits on {actualPageCount} {actualPageCount === 1 ? "page" : "pages"} (A4).
        </p>
      )}
    </div>
  );
}
