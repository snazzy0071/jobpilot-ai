import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/admin/overview/count-up";
import { Sparkline } from "@/components/admin/overview/sparkline";
import type { CountKind } from "@/components/admin/overview/format";
import { cn } from "@/lib/utils";

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
}: {
  label: string;
  icon: LucideIcon;
  /** `null` means the figure couldn't be loaded: shown as unavailable, never as a zero. */
  value: number | null;
  kind?: CountKind;
  caption?: string;
  trend?: Trend;
  spark?: number[];
}) {
  if (value === null) {
    return (
      <Card variant="metric" className="gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <h3 className="text-xs font-medium tracking-wide uppercase">{label}</h3>
          <Icon className="size-4 shrink-0" aria-hidden />
        </div>
        <span className="font-heading text-3xl font-semibold tracking-tight text-muted-foreground" aria-label="Unavailable">
          —
        </span>
        <p className="text-xs text-muted-foreground">Unavailable</p>
      </Card>
    );
  }
  return (
    <Card variant="metric" className="gap-2.5 p-4">
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <h3 className="text-xs font-medium tracking-wide uppercase">{label}</h3>
        <Icon className="size-4 shrink-0" aria-hidden />
      </div>
      <CountUp value={value} kind={kind} className="font-heading text-3xl font-semibold tracking-tight tabular-nums" />
      {trend && <TrendChip trend={trend} />}
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
      {spark && spark.length > 1 && <Sparkline values={spark} className="mt-auto h-8 w-full pt-1" />}
    </Card>
  );
}
