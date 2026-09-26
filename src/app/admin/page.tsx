import {
  UsersIcon,
  UserPlusIcon,
  ActivityIcon,
  CreditCardIcon,
  BanknoteIcon,
  SparklesIcon,
  ScanSearchIcon,
  FileTextIcon,
  MessagesSquareIcon,
  ClipboardListIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getGrantedPermissions } from "@/lib/admin/permissions";
import { getAdminOverview } from "@/lib/admin/overview/queries";
import { listRecentAdminActivity } from "@/lib/admin/audit/queries";
import { runAllHealthChecks } from "@/lib/health/checks";
import { Card } from "@/components/ui/card";
import { MetricCard, type Trend } from "@/components/admin/overview/metric-card";
import { DailyBarChart } from "@/components/admin/overview/daily-bar-chart";
import { formatCount, percentChange } from "@/components/admin/overview/format";
import {
  ActivityPanel,
  AiPanel,
  ApplicationsPanel,
  AttentionPanel,
  BillingPanel,
  FailuresPanel,
  HealthPanel,
  InstitutionsPanel,
  Panel,
  PipelinesPanel,
  UnavailablePanel,
  type AttentionItem,
} from "@/components/admin/overview/panels";

export const dynamic = "force-dynamic";

const PREVIOUS_LABEL = "vs previous 30 days";

/**
 * Platform-wide overview. Every figure comes from a real query
 * (src/lib/admin/overview/queries.ts, backed by migrations 0090/0091):
 * nothing is estimated, seeded or rounded up. Where there is no earlier
 * data to compare with, a trend says so instead of inventing a percentage,
 * and a figure whose query failed shows as unavailable, never as zero.
 *
 * Everything that was visible to any admin before (users, billing, AI,
 * product usage, sync status, recent failures) still is. Two sections
 * that expose data already behind its own permission stay behind it here
 * too: recent admin activity needs `view_audit_logs`, and system health
 * needs `view_system_health`.
 */
export default async function AdminOverviewPage() {
  const { user } = await requireAdmin();
  const permissions = await getGrantedPermissions(user.id);
  const canSeeHealth = permissions.has("view_system_health");
  const canSeeAudit = permissions.has("view_audit_logs");

  const [{ overview, loadError }, health, activity] = await Promise.all([
    getAdminOverview(),
    canSeeHealth ? runAllHealthChecks() : Promise.resolve(null),
    canSeeAudit ? listRecentAdminActivity(8) : Promise.resolve(null),
  ]);

  const { daily, current, previous, users, billing, ai, product, institutions, jobs, sponsors, failures7d, loaded } = overview;
  const hasDaily = loaded.daily;
  const hasSnapshot = loaded.snapshot;

  const series = (key: keyof (typeof daily)[number]) => (hasDaily ? daily.map((point) => Number(point[key])) : undefined);
  const trend = (cur: number, prev: number, better: Trend["better"] = "up"): Trend | undefined =>
    hasDaily ? { pct: percentChange(cur, prev), better, label: PREVIOUS_LABEL } : undefined;
  const n = (value: number) => value.toLocaleString("en-GB");

  // ---- what needs a human (only ever from data that actually loaded) ---------
  const attention: AttentionItem[] = [];
  if (health) {
    for (const check of health) {
      if (check.status === "down") attention.push({ tone: "bad", text: `${check.label} is down`, href: "/admin/system-health" });
      if (check.status === "degraded") attention.push({ tone: "warn", text: `${check.label} is degraded`, href: "/admin/system-health" });
    }
  }
  if (hasSnapshot && failures7d.webhooksUnresolved > 0) {
    attention.push({
      tone: "bad",
      text: `${failures7d.webhooksUnresolved} Stripe webhook event${failures7d.webhooksUnresolved === 1 ? " is" : "s are"} still failing`,
    });
  }
  if (hasSnapshot && billing.pastDue > 0) {
    attention.push({ tone: "warn", text: `${billing.pastDue} subscription${billing.pastDue === 1 ? " is" : "s are"} past due` });
  }
  if (hasSnapshot && failures7d.payments > 0) {
    attention.push({ tone: "warn", text: `${failures7d.payments} failed payment${failures7d.payments === 1 ? "" : "s"} in the last 7 days` });
  }
  for (const source of jobs.sources) {
    const href = permissions.has("view_job_sync") ? "/admin/jobs" : undefined;
    if (source.state === "failed") attention.push({ tone: "bad", text: `${source.sourceName} job sync failed on its last run`, href });
    if (source.state === "stale") attention.push({ tone: "warn", text: `${source.sourceName} job sync is stale (no completed run in 24 hours)`, href });
  }
  if (sponsors.state === "failed") {
    attention.push({ tone: "bad", text: "The last sponsor register import failed", href: permissions.has("view_sponsor_sync") ? "/admin/sponsors" : undefined });
  }
  if (sponsors.state === "stale") {
    attention.push({ tone: "warn", text: "The sponsor register hasn't synced in over 36 hours", href: permissions.has("view_sponsor_sync") ? "/admin/sponsors" : undefined });
  }
  if (hasSnapshot && failures7d.emails > 0) {
    attention.push({
      tone: "warn",
      text: `${failures7d.emails} email${failures7d.emails === 1 ? "" : "s"} failed to send in the last 7 days`,
      href: permissions.has("view_email_logs") ? "/admin/email-logs" : undefined,
    });
  }
  if (hasDaily && ai.calls30d >= 20 && ai.successRate !== null && ai.successRate < 90) {
    attention.push({ tone: "warn", text: `AI success rate is ${ai.successRate}% over 30 days`, href: permissions.has("view_ai_usage") ? "/admin/ai-usage" : undefined });
  }
  if (hasSnapshot && institutions.expiring30d > 0) {
    attention.push({
      tone: "warn",
      text: `${institutions.expiring30d} institution licence${institutions.expiring30d === 1 ? "" : "s"} expiring within 30 days`,
      href: permissions.has("manage_institutions") ? "/admin/institutions" : undefined,
    });
  }

  const updated = new Date(overview.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live figures from the database, updated {updated} (UK time). Daily charts use UTC days. &ldquo;Active&rdquo; means a user did at least one
          recorded action: an AI call, CV, ATS scan, interview, cover letter or application.
        </p>
      </div>

      {loadError && (
        <Card className="flex-row items-start gap-2 border-destructive/40 p-3 text-sm" role="alert">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>{loadError}</p>
        </Card>
      )}

      <AttentionPanel items={attention} />

      <section aria-label="Key metrics" className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            label="Total users"
            icon={UsersIcon}
            value={hasSnapshot ? users.total : null}
            caption={hasDaily ? `${n(users.new7d)} joined in the last 7 days` : undefined}
          />
          <MetricCard
            label="New users (30d)"
            icon={UserPlusIcon}
            value={hasDaily ? users.new30d : null}
            trend={trend(current.newUsers, previous.newUsers)}
            spark={series("newUsers")}
          />
          <MetricCard
            label="Active users (30d)"
            icon={ActivityIcon}
            value={hasSnapshot ? users.active30d : null}
            caption={`${n(users.active7d)} in 7 days · ${n(users.active1d)} in 24 hours`}
            spark={series("activeUsers")}
          />
          <MetricCard
            label="Paying subscriptions"
            icon={CreditCardIcon}
            value={hasSnapshot ? billing.activePaid : null}
            caption={`${billing.trialing} trialing · ${billing.pastDue} past due`}
          />
          <MetricCard
            label="MRR"
            icon={BanknoteIcon}
            value={hasSnapshot ? billing.mrrPence : null}
            kind="gbp"
            caption={`ARR ${formatCount(billing.arrPence, "gbp")} · active paid plans only`}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <MetricCard
            label="AI cost (30d, est.)"
            icon={SparklesIcon}
            value={hasDaily ? ai.costUsd30d : null}
            kind="usd"
            caption={`${n(ai.calls30d)} calls${ai.successRate !== null ? ` · ${ai.successRate}% succeeded` : ""}`}
            trend={trend(current.aiCostUsd, previous.aiCostUsd, "neutral")}
            spark={series("aiCostUsd")}
          />
          <MetricCard
            label="ATS scans (30d)"
            icon={ScanSearchIcon}
            value={hasDaily ? current.atsScans : null}
            caption={hasSnapshot ? `${n(product.atsScans)} all time${product.atsAvgMatch30d !== null ? ` · avg match ${product.atsAvgMatch30d}%` : ""}` : undefined}
            trend={trend(current.atsScans, previous.atsScans)}
            spark={series("atsScans")}
          />
          <MetricCard
            label="CVs created (30d)"
            icon={FileTextIcon}
            value={hasDaily ? current.cvsCreated : null}
            caption={hasSnapshot ? `${n(product.cvs)} in total` : undefined}
            trend={trend(current.cvsCreated, previous.cvsCreated)}
            spark={series("cvsCreated")}
          />
          <MetricCard
            label="Interviews (30d)"
            icon={MessagesSquareIcon}
            value={hasDaily ? current.interviews : null}
            caption={hasSnapshot ? `${n(product.interviews)} in total · ${n(product.interviewsCompleted)} completed` : undefined}
            trend={trend(current.interviews, previous.interviews)}
            spark={series("interviews")}
          />
          <MetricCard
            label="Applications (30d)"
            icon={ClipboardListIcon}
            value={hasDaily ? current.applicationsCreated : null}
            caption={hasSnapshot ? `${n(product.applications)} tracked in total` : undefined}
            trend={trend(current.applicationsCreated, previous.applicationsCreated)}
            spark={series("applicationsCreated")}
          />
        </div>
      </section>

      {hasDaily ? (
        <section aria-label="Trends" className="grid gap-3 lg:grid-cols-3">
          <Panel title="New sign-ups" description="Per day, last 30 days">
            <DailyBarChart data={daily.map((p) => ({ day: p.day, value: p.newUsers }))} unit="sign-ups" />
          </Panel>
          <Panel title="Daily active users" description="Distinct users with a recorded action that day">
            <DailyBarChart data={daily.map((p) => ({ day: p.day, value: p.activeUsers }))} unit="active users" />
          </Panel>
          <Panel title="AI calls" description="Per day. Red is the share that failed">
            <DailyBarChart data={daily.map((p) => ({ day: p.day, value: p.aiCalls, flagged: p.aiFailed }))} unit="calls" flaggedLabel="failed" />
          </Panel>
        </section>
      ) : (
        <UnavailablePanel title="Trends" />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {hasSnapshot ? <BillingPanel billing={billing} /> : <UnavailablePanel title="Subscriptions & billing" />}
        {hasSnapshot && hasDaily ? <AiPanel ai={ai} /> : <UnavailablePanel title="AI usage & cost (30 days)" />}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {hasSnapshot ? <ApplicationsPanel product={product} /> : <UnavailablePanel title="Applications by stage" />}
        {hasSnapshot ? (
          <InstitutionsPanel institutions={institutions} showLink={permissions.has("manage_institutions")} />
        ) : (
          <UnavailablePanel title="Institutions" />
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <PipelinesPanel
          sources={jobs.sources}
          activeListings={hasSnapshot ? jobs.activeListings : null}
          sponsors={sponsors}
          links={{ jobs: permissions.has("view_job_sync"), sponsors: permissions.has("view_sponsor_sync") }}
        />
        <FailuresPanel counts={hasSnapshot ? failures7d : null} recent={overview.recentFailures} />
      </div>

      {(health || activity) && (
        <div className="grid gap-3 lg:grid-cols-2">
          {health && <HealthPanel checks={health} />}
          {activity && <ActivityPanel entries={activity} />}
        </div>
      )}
    </div>
  );
}
