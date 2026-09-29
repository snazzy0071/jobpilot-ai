import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/admin/overview/count-up";
import { Sparkline } from "@/components/admin/overview/sparkline";
import type { CountKind } from "@/components/admin/overview/format";
import { cn } from "@/lib/utils";

// Blue-family + amber + rose only — no purple/indigo/green, per the client's brand direction. A plain white card with
// a small tinted icon read as "still just a white card" ("admin cards must be colourful... not simple white bg"),
// so the tint now colours the whole card — a soft gradient wash at rest, not just a hover effect — plus a solid
// icon chip, not just the icon glyph.
export const METRIC_TINTS = {
  blue: { card: "border-blue-200/70 bg-gradient-to-br from-blue-50 to-white", icon: "bg-blue-600 text-white" },
  sky: { card: "border-sky-200/70 bg-gradient-to-br from-sky-50 to-white", icon: "bg-sky-600 text-white" },
  cyan: { card: "border-cyan-200/70 bg-gradient-to-br from-cyan-50 to-white", icon: "bg-cyan-600 text-white" },
  amber: { card: "border-amber-200/70 bg-gradient-to-br from-amber-50 to-white", icon: "bg-amber-600 text-white" },
  rose: { card: "border-rose-200/70 bg-gradient-to-br from-rose-50 to-white", icon: "bg-rose-600 text-white" },
} as const;
export type MetricTint = keyof typeof METRIC_TINTS;

export type Trend = {
  /** Change vs the previous window; `null` when there is no previous figure to compare with. */
  pct: number | null;
  /** Which direction is good news for this metric (revenue up is good, failures up is not). */
  better: "up" | "down" | "neutral";
  /** e.g. "vs previous 30 days". */
  label: string;
};

function TrendChip({ trend }: { trend: Trend }) {
  if (trend.pct === null) {
    return <span className="text-xs text-muted-foreground">No earlier data to compare</span>;
  }
  const direction = trend.pct > 0 ? "up" : trend.pct < 0 ? "down" : "flat";
  const good = direction === "flat" || trend.better === "neutral" ? null : direction === trend.better;
  const Icon = direction === "up" ? ArrowUpRightIcon : direction === "down" ? ArrowDownRightIcon : MinusIcon;
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
          good === true && "bg-success/12 text-success",
          good === false && "bg-destructive/10 text-destructive",
          good === null && "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-3" aria-hidden />
        {Math.abs(trend.pct).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%
        <span className="sr-only"> {direction === "up" ? "increase" : direction === "down" ? "decrease" : "no change"}</span>
      </span>
      <span className="text-muted-foreground">{trend.label}</span>
    </span>
  );
}

/**
 * A KPI tile: label, a counting-up figure, an optional honest trend
 * (vs the previous equal window), a caption and a full-width sparkline
 * of the same metric per day. Deliberately flat and dense — this is a working
 * dashboard, not a marketing page.
 */
export function MetricCard({
  label,
  icon: Icon,
  value,
  kind = "number",
  caption,
  trend,
  spark,
  tint = "blue",
}: {
  label: string;
  icon: LucideIcon;
  /** `null` means the figure couldn't be loaded: shown as unavailable, never as a zero. */
  value: number | null;
  kind?: CountKind;
  caption?: string;
  trend?: Trend;
  spark?: number[];
  tint?: MetricTint;
}) {
  const { card: cardTint, icon: iconTint } = METRIC_TINTS[tint];
  const iconTile = (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm", iconTint)}>
      <Icon className="size-4" aria-hidden />
    </span>
  );

  if (value === null) {
    return (
      <Card variant="metric" className={cn("gap-2.5 p-4", cardTint)}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
          {iconTile}
        </div>
        <span className="font-heading text-3xl font-semibold tracking-tight text-muted-foreground" aria-label="Unavailable">
          —
        </span>
        <p className="text-xs text-muted-foreground">Unavailable</p>
      </Card>
    );
  }
  return (
    <Card variant="metric" className={cn("gap-2.5 p-4", cardTint)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</h3>
        {iconTile}
      </div>
      <CountUp value={value} kind={kind} className="font-heading text-3xl font-semibold tracking-tight tabular-nums" />
      {trend && <TrendChip trend={trend} />}
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      {spark && spark.length > 1 && <Sparkline values={spark} className="mt-auto h-8 w-full pt-1" />}
    </Card>
  );
}
