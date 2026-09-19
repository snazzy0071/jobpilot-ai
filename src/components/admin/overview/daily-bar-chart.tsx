"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatCount, formatDay, type CountKind } from "@/components/admin/overview/format";

// `useReducedMotion()` is null until the client has read the media query, so the server-rendered markup (and the first
// client render) always starts hidden. Keying on the resolved value remounts the element the moment a reduced-motion
// preference is known, this time already at its final size — so those users never sit on an invisible bar waiting
// for an animation that will not play.
export type DailyBar = {
  day: string;
  value: number;
  /** A subset of `value` to draw in the alert colour (e.g. failed AI calls). */
  flagged?: number;
};

/**
 * One value per UTC day as a bar chart. Hover a bar to read that day; the
 * headline line always shows the window total, daily average and peak, so
 * nothing depends on hovering. Bars grow in once as the chart scrolls into
 * view (skipped for reduced motion). A visually hidden table carries every
 * data point for assistive tech. Zero days keep a faint tick so a quiet day
 * reads as "zero", not "missing".
 */
export function DailyBarChart({
  data,
  kind = "number",
  unit,
  flaggedLabel,
  height = 132,
}: {
  data: DailyBar[];
  kind?: CountKind;
  /** Noun for the readout, e.g. "sign-ups". */
  unit: string;
  flaggedLabel?: string;
  height?: number;
}) {
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  const total = data.reduce((sum, bar) => sum + bar.value, 0);
  const max = Math.max(...data.map((bar) => bar.value), 0);
  const peak = data.find((bar) => bar.value === max && max > 0);
  const average = data.length > 0 ? total / data.length : 0;
  const shown = active !== null ? data[active] : null;
  const first = data[0];
  const middle = data[Math.floor(data.length / 2)];
  const last = data[data.length - 1];

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-sm">
        {shown ? (
          <>
            <span className="font-medium">{formatDay(shown.day, "long")}</span>
            <span className="text-muted-foreground">
              {" "}
              · {formatCount(shown.value, kind)} {unit}
              {shown.flagged ? ` (${formatCount(shown.flagged, "number")} ${flaggedLabel ?? "flagged"})` : ""}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{formatCount(total, kind)}</span> {unit} in {data.length} days · avg{" "}
            {formatCount(average, kind)}/day
            {peak ? ` · peak ${formatCount(peak.value, kind)} on ${formatDay(peak.day)}` : ""}
          </span>
        )}
      </p>

      <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
        <span aria-hidden className="pointer-events-none absolute top-0 left-0 text-[10px] text-muted-foreground tabular-nums">
          {max > 0 ? formatCount(max, kind) : ""}
        </span>
        <div
          className="absolute inset-x-0 bottom-0 flex h-[calc(100%-14px)] items-end gap-[2px]"
          role="img"
          aria-label={`${unit} per day, ${data.length} days, ${formatCount(total, kind)} in total`}
        >
          {data.map((bar, index) => {
            const ratio = max > 0 ? bar.value / max : 0;
            const flaggedRatio = bar.value > 0 && bar.flagged ? Math.min(1, bar.flagged / bar.value) : 0;
            return (
              <div key={bar.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setActive(index)}>
                {bar.value === 0 ? (
                  <div className="h-px w-full bg-muted-foreground/30" />
                ) : (
                  <motion.div
                    key={reducedMotion ? "reduced" : "motion"}
                    className="relative flex w-full origin-bottom flex-col justify-end overflow-hidden rounded-t-[2px] bg-primary/80 transition-colors hover:bg-primary"
                    style={{ height: `${Math.max(ratio * 100, 3)}%` }}
                    initial={{ scaleY: reducedMotion ? 1 : 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: reducedMotion ? 0 : index * 0.012, ease: "easeOut" }}
                  >
                    {flaggedRatio > 0 && <div className="w-full bg-destructive" style={{ height: `${flaggedRatio * 100}%` }} />}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden>
        <span>{first ? formatDay(first.day) : ""}</span>
        <span>{middle ? formatDay(middle.day) : ""}</span>
        <span>{last ? formatDay(last.day) : ""}</span>
      </div>

      <table className="sr-only">
        <caption>{unit} per day (UTC)</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">{unit}</th>
            {flaggedLabel && <th scope="col">{flaggedLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((bar) => (
            <tr key={bar.day}>
              <th scope="row">{formatDay(bar.day, "long")}</th>
              <td>{formatCount(bar.value, kind)}</td>
              {flaggedLabel && <td>{bar.flagged ?? 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
