import {
  UsersIcon,
  CreditCardIcon,
  SparklesIcon,
  ScanSearchIcon,
  MessagesSquareIcon,
  BuildingIcon,
  BriefcaseIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getUserMetrics,
  getBillingMetrics,
  getAiUsageMetrics,
  getAtsScanMetrics,
  getInterviewMetrics,
  getJobSyncStatus,
  getSponsorSyncStatus,
  getRecentErrors,
} from "@/lib/admin/overview/queries";

export const dynamic = "force-dynamic";

function formatGbp(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never run";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatTile({ icon: Icon, label, value, caption }: { icon: typeof UsersIcon; label: string; value: string; caption?: string }) {
  return (
    <Card className="gap-1 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}

/**
 * Platform-wide metrics — every number here comes from a real
 * aggregate query (src/lib/admin/overview/queries.ts), never a
 * placeholder. Two pipelines (sponsor sync, and any job source with no
 * completed run yet) render an honest "Never run" instead of a fake
 * zero when their own schema has no history to report — see that
 * file's own comments for which tables back which section.
 */
export default async function AdminOverviewPage() {
  const [users, billing, aiUsage, atsScans, interviews, jobSync, sponsorSync, recentErrors] = await Promise.all([
    getUserMetrics(),
    getBillingMetrics(),
    getAiUsageMetrics(),
    getAtsScanMetrics(),
    getInterviewMetrics(),
    getJobSyncStatus(),
    getSponsorSyncStatus(),
    getRecentErrors(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="mt-1 text-muted-foreground">Platform-wide metrics across billing, AI usage, and every sync pipeline.</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Users &amp; billing</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={UsersIcon} label="Total users" value={users.totalUsers.toLocaleString()} caption={`+${users.newUsersLast30Days} in last 30 days`} />
          <StatTile
            icon={CreditCardIcon}
            label="MRR"
            value={formatGbp(billing.mrrPence)}
            caption={`${billing.activeSubscriptions} active paid subscription${billing.activeSubscriptions === 1 ? "" : "s"}`}
          />
          <StatTile icon={CreditCardIcon} label="Trialing" value={`${billing.trialingSubscriptions}`} />
          <StatTile icon={CreditCardIcon} label="Past due" value={`${billing.pastDueSubscriptions}`} caption={billing.pastDueSubscriptions > 0 ? "Payment retrying" : undefined} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">AI usage</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={SparklesIcon} label="Calls (30d)" value={aiUsage.callsLast30Days.toLocaleString()} />
          <StatTile
            icon={SparklesIcon}
            label="Success rate (30d)"
            value={aiUsage.successRateLast30Days !== null ? `${aiUsage.successRateLast30Days}%` : "—"}
          />
          <StatTile icon={SparklesIcon} label="Estimated cost (30d)" value={formatUsd(aiUsage.costLast30DaysUsd)} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Product usage</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={ScanSearchIcon} label="ATS scans" value={atsScans.totalScans.toLocaleString()} caption={`${atsScans.scansLast30Days} in last 30 days`} />
          <StatTile
            icon={MessagesSquareIcon}
            label="Interviews"
            value={interviews.totalSessions.toLocaleString()}
            caption={`${interviews.completedSessions} completed · ${interviews.sessionsLast30Days} in last 30 days`}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Sync pipelines</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BriefcaseIcon className="size-4" /> Job sync
            </div>
            {jobSync.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active job sources configured.</p>
            ) : (
              jobSync.map((source) => (
                <div key={source.sourceName} className="flex items-center justify-between text-sm">
                  <span>{source.sourceName}</span>
                  <span className="text-muted-foreground">
                    {formatDateTime(source.lastCompletedAt)}
                    {source.createdCount !== null ? ` · +${source.createdCount} new` : ""}
                  </span>
                </div>
              ))
            )}
          </Card>

          <Card className="gap-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <BuildingIcon className="size-4" /> Sponsor register sync
            </div>
            {sponsorSync ? (
              <div className="flex items-center justify-between text-sm">
                <span>Last completed</span>
                <span className="text-muted-foreground">
                  {formatDateTime(sponsorSync.lastCompletedAt)}
                  {sponsorSync.sponsorCount !== null ? ` · ${sponsorSync.sponsorCount.toLocaleString()} sponsors` : ""}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Never run.</p>
            )}
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Recent errors</h2>
        {recentErrors.length === 0 ? (
          <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" /> No recent failures across AI calls, job sync, or sponsor sync.
          </Card>
        ) : (
          <Card className="divide-y p-0">
            {recentErrors.map((error) => (
              <div key={`${error.source}-${error.id}`} className="flex items-start gap-3 p-4">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{error.source === "ai" ? "AI" : error.source === "job_sync" ? "Job sync" : "Sponsor sync"}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(error.occurredAt)}</span>
                  </div>
                  <p className="mt-1 text-sm">{error.message}</p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
