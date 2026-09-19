"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// `useReducedMotion()` is null until the client has read the media query, so the server-rendered markup (and the first
// client render) always starts hidden. Keying on the resolved value remounts the element the moment a reduced-motion
// preference is known, this time already at its final size — so those users never sit on an invisible bar waiting
// for an animation that will not play.
export type StackedSegment = { label: string; value: number; className: string };

/**
 * A single horizontal bar split into proportional segments, with a legend
 * that repeats every number as text (colour is never the only signal).
 * Segments grow in once when scrolled into view. All-zero input renders an
 * empty track and the caption, not a fake split.
 */
export function StackedBar({ segments, emptyLabel = "Nothing to show yet." }: { segments: StackedSegment[]; emptyLabel?: string }) {
  const reducedMotion = useReducedMotion();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted">
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment, index) => (
              <motion.div
                key={`${segment.label}-${reducedMotion ? "reduced" : "motion"}`}
                className={cn("h-full origin-left", segment.className)}
                style={{ flexGrow: segment.value, flexBasis: 0 }}
                initial={{ scaleX: reducedMotion ? 1 : 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: reducedMotion ? 0 : index * 0.08, ease: "easeOut" }}
              />
            ))}
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-1.5">
              <span aria-hidden className={cn("size-2 rounded-full", segment.className)} />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="font-medium tabular-nums">{segment.value.toLocaleString("en-GB")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
