import { AlertTriangleIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Panel, Stat } from "@/components/admin/overview/panels";
import { MetricCard } from "@/components/admin/overview/metric-card";
import { UsersIcon, SendIcon, CheckCircle2Icon, InboxIcon } from "lucide-react";
import { getAutoApplyAdminData } from "@/lib/admin/auto-apply/queries";
import { QUEUE_STATUSES, QUEUE_STATUS_LABELS } from "@/lib/auto-apply/types";

export const dynamic = "force-dynamic";

export default async function AdminAutoApplyPage() {
  const data = await getAutoApplyAdminData();

  if (!data) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <Card className="flex-row items-start gap-2 border-destructive/40 p-3 text-sm" role="alert">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>These figures couldn&apos;t be loaded. Has migration 0122 been applied?</p>
        </Card>
      </div>
    );
  }

  const canSubmitAnywhere = data.adapters.some((adapter) => adapter.canSubmit);
  const totalQueue = Object.values(data.queueByStatus).reduce((sum, n) => sum + n, 0);
  const events = Object.entries(data.events7d).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Users with rules saved" icon={UsersIcon} value={data.usersWithSettings} caption={`${data.consented} gave consent`} />
        <MetricCard label="Turned on" icon={SendIcon} value={data.enabled} caption={`${data.paused} paused`} />
        <MetricCard label="Queued (30d)" icon={InboxIcon} value={data.queued30d} caption={`${data.approved30d} approved`} />
        <MetricCard label="Confirmed applied (30d)" icon={CheckCircle2Icon} value={data.applied30d} caption={`${data.usersWithQueue} users have a queue`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Queue by status" description={`${totalQueue.toLocaleString("en-GB")} queue items across every user`}>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {QUEUE_STATUSES.map((status) => (
              <Stat key={status} label={QUEUE_STATUS_LABELS[status]} value={(data.queueByStatus[status] ?? 0).toLocaleString("en-GB")} />
            ))}
          </dl>
        </Panel>

        <Panel title="Adapters" description="What this deployment can actually do when an application is approved.">
          <ul className="flex flex-col gap-2 text-sm" data-testid="auto-apply-adapters">
            {data.adapters.map((adapter) => (
              <li key={adapter.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{adapter.label}</span>
                <span className="text-xs text-muted-foreground">
                  {adapter.canSubmit ? "submits applications" : "hands the user the employer link"} · {(data.byAdapter[adapter.id] ?? 0).toLocaleString("en-GB")} items
                </span>
              </li>
            ))}
          </ul>
          {!canSubmitAnywhere && (
            <p className="text-xs text-muted-foreground">
              No adapter submits applications: none of the job sources offers an apply API, and the feature never works around a site&apos;s protections. Every approved application ends with the user applying themselves.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Activity, last 7 days" description="Audit events written by the feature, by type.">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity in the last 7 days.</p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {events.map(([event, count]) => (
              <Stat key={event} label={event.replace(/_/g, " ")} value={count.toLocaleString("en-GB")} />
            ))}
          </dl>
        )}
      </Panel>
    </div>
  );
}
