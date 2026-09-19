import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { APPLICATION_STATUS_LABELS } from "@/lib/applications/types";
import type { ApplicationFunnelAnalytics } from "@/lib/applications/analytics";

const SPONSOR_SPLIT_LABELS: Record<string, string> = {
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
  not_found: "Not on register",
  not_checked: "Not checked",
};

function StatTile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <Card variant="metric" className="gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}

function StatBar({ label, count, total }: { label: string; count: number; total: number }) {
  const width = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{count.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/**
 * Real numbers only — src/lib/applications/analytics.ts's
 * getApplicationFunnelAnalytics, computed live from this user's own
 * applications and application_status_history. Every rate is `null`
 * (rendered as "—", never a fabricated 0%/100%) when there isn't
 * enough data yet to compute it honestly.
 */
export function ApplicationFunnelStats({ analytics }: { analytics: ApplicationFunnelAnalytics }) {
  if (analytics.totalApplications === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No applications tracked yet</p>
        <p className="text-sm text-muted-foreground">Add one to start seeing your own funnel here.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total applications" value={analytics.totalApplications.toLocaleString()} />
        <StatTile
          label="Interview rate"
          value={analytics.interviewRate !== null ? `${analytics.interviewRate}%` : "—"}
          caption="of applied"
        />
        <StatTile label="Offer rate" value={analytics.offerRate !== null ? `${analytics.offerRate}%` : "—"} caption="of applied" />
        <StatTile
          label="Average match score"
          value={analytics.averageMatchScore.value !== null ? `${analytics.averageMatchScore.value}/100` : "—"}
          caption={analytics.averageMatchScore.sampleSize > 0 ? `across ${analytics.averageMatchScore.sampleSize} scored` : "none scored yet"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-4 p-6">
          <p className="text-sm font-medium">Applications by stage</p>
          <div className="flex flex-col gap-3">
            {analytics.byStage.map((stage) => (
              <StatBar key={stage.status} label={APPLICATION_STATUS_LABELS[stage.status]} count={stage.currentCount} total={analytics.totalApplications} />
            ))}
          </div>
        </Card>

        <Card className="gap-4 p-6">
          <p className="text-sm font-medium">Sponsor split</p>
          <div className="flex flex-col gap-3">
            {analytics.sponsorSplit.map((entry) => (
              <StatBar key={entry.status} label={SPONSOR_SPLIT_LABELS[entry.status]} count={entry.count} total={analytics.totalApplications} />
            ))}
          </div>
        </Card>
      </div>

      <Card className="gap-4 p-6">
        <p className="text-sm font-medium">Conversion funnel</p>
        <p className="text-xs text-muted-foreground">
          Based on every application that has ever reached each stage (src/lib/applications/analytics.ts) — not just where it
          sits today.
        </p>
        <div className="flex flex-col gap-3">
          {analytics.stageConversions.map((conversion) => (
            <div key={`${conversion.from}-${conversion.to}`} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{APPLICATION_STATUS_LABELS[conversion.from]}</span>
                <span className="text-muted-foreground">({conversion.fromCount})</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
                <span className="font-medium">{APPLICATION_STATUS_LABELS[conversion.to]}</span>
                <span className="text-muted-foreground">({conversion.toCount})</span>
              </div>
              <span className="font-medium text-primary">{conversion.rate !== null ? `${conversion.rate}%` : "—"}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
