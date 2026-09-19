"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/components/cvs/templates/design";

/**
 * Page one of a CV, scaled down to fill its container's width at A4
 * proportions. Purely visual: the copy of the CV inside is hidden from
 * assistive tech and inert (no tab stops on its contact links) — the card
 * that wraps it carries the accessible name.
 */
export function TemplateThumbnailFrame({ children, backgroundImage }: { children: ReactNode; backgroundImage?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.28);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setScale(width / PAGE_WIDTH);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden bg-white" style={{ aspectRatio: "210 / 297" }} aria-hidden inert>
      <div
        className="pointer-events-none absolute top-0 left-0 origin-top-left overflow-hidden text-black"
        style={{ width: PAGE_WIDTH, height: PAGE_HEIGHT, transform: `scale(${scale})`, backgroundColor: "#ffffff", backgroundImage }}
      >
        {children}
      </div>
    </div>
  );
}
