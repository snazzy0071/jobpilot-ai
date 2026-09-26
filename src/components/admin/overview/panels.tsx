import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangleIcon, CheckCircle2Icon, CircleOffIcon, XCircleIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedBar } from "@/components/dashboard/animated-bar";
import { StackedBar } from "@/components/admin/overview/stacked-bar";
import { formatCount, formatDateTime, timeAgo } from "@/components/admin/overview/format";
import type {
  BillingOverview,
  FailureCounts7d,
  InstitutionOverview,
  RecentFailure,
  FailureSource,
  SponsorSync,
  JobSourceSync,
  SyncState,
  AdminOverview,
} from "@/lib/admin/overview/types";
import type { AdminAuditLogEntry } from "@/lib/admin/audit/types";
import type { HealthCheckResult, HealthStatus } from "@/lib/health/types";
import { cn } from "@/lib/utils";

// ---- shared bits -----------------------------------------------------------

type Tone = "ok" | "warn" | "bad" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  ok: "border-success/30 bg-success/10 text-success",
  warn: "border-warning/30 bg-warning/10 text-warning",
  bad: "border-destructive/30 bg-destructive/10 text-destructive",
  muted: "border-border bg-muted text-muted-foreground",
};

/** A status is always a word plus a shape, never colour alone. */
export function StatusPill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const Icon = tone === "ok" ? CheckCircle2Icon : tone === "bad" ? XCircleIcon : tone === "warn" ? AlertTriangleIcon : CircleOffIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", TONE_CLASS[tone], className)}>
      <Icon className="size-3" aria-hidden />
      {children}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-4 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Stands in for a panel whose aggregate query failed: visible, honest, and never a row of zeros. */
export function UnavailablePanel({ title }: { title: string }) {
  return (
    <Panel title={title}>
      <p className="text-sm text-muted-foreground">Unavailable. This section&apos;s data couldn&apos;t be loaded (see the notice above).</p>
    </Panel>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-heading text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const SYNC_TONE: Record<SyncState, { tone: Tone; label: string }> = {
  ok: { tone: "ok", label: "Healthy" },
  stale: { tone: "warn", label: "Stale" },
  failed: { tone: "bad", label: "Last run failed" },
  never: { tone: "muted", label: "Never run" },
  running: { tone: "muted", label: "Running" },
};

const HEALTH_TONE: Record<HealthStatus, { tone: Tone; label: string }> = {
  operational: { tone: "ok", label: "Operational" },
  degraded: { tone: "warn", label: "Degraded" },
  down: { tone: "bad", label: "Down" },
  not_configured: { tone: "muted", label: "Not configured" },
};

// ---- needs attention -------------------------------------------------------

export type AttentionItem = { tone: "warn" | "bad"; text: string; href?: string };

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <Card className="flex-row items-center gap-2 p-3 text-sm text-muted-foreground">
        <CheckCircle2Icon className="size-4 shrink-0 text-success" aria-hidden />
        Nothing needs attention: no failed syncs, failing webhooks, past-due payments or degraded services right now.
      </Card>
    );
  }
  return (
    <Card className="gap-2 border-warning/40 p-4" role="region" aria-label="Needs attention">
      <h2 className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
        <AlertTriangleIcon className="size-4 text-warning" aria-hidden /> Needs attention
        <span className="text-xs font-normal text-muted-foreground">({items.length})</span>
      </h2>
      <ul className="flex flex-col divide-y text-sm">
        {items.map((item) => (
          <li key={item.text} className="flex items-center justify-between gap-3 py-1.5">
            <span className="flex items-center gap-2">
              <span aria-hidden className={cn("size-1.5 rounded-full", item.tone === "bad" ? "bg-destructive" : "bg-warning")} />
              {item.text}
            </span>
            {item.href && (
              <Link href={item.href} className="shrink-0 text-xs font-medium text-primary hover:underline">
                Open
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---- subscriptions & billing -----------------------------------------------

export function BillingPanel({ billing }: { billing: BillingOverview }) {
  return (
    <Panel
      title="Subscriptions & billing"
      description="MRR counts active paid subscriptions that Stripe bills. Trials haven't been charged, past-due payments have already failed once, and complimentary or access-code plans bring in nothing."
    >
      <dl className="grid grid-cols-3 gap-4">
        <Stat label="MRR" value={formatCount(billing.mrrPence, "gbp")} />
        <Stat label="ARR (MRR × 12)" value={formatCount(billing.arrPence, "gbp")} />
        <Stat label="Paying" value={billing.activePaid.toLocaleString("en-GB")} hint={billing.complimentary > 0 ? `+ ${billing.complimentary.toLocaleString("en-GB")} complimentary` : undefined} />
      </dl>

      <StackedBar
        emptyLabel="No subscriptions yet."
        segments={[
          { label: "Active paid", value: billing.activePaid, className: "bg-success" },
          { label: "Trialing", value: billing.trialing, className: "bg-primary" },
          { label: "Past due", value: billing.pastDue, className: "bg-warning" },
          { label: "Incomplete", value: billing.incomplete, className: "bg-muted-foreground/50" },
          { label: "Canceled", value: billing.canceled, className: "bg-destructive/60" },
        ]}
      />

      {billing.byPlan.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">Plan</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Active</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Trial</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Past due</th>
                <th scope="col" className="py-1.5 pl-2 text-right font-medium">MRR</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {billing.byPlan.map((plan) => (
                <tr key={plan.slug} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium">{plan.name}</th>
                  <td className="px-2 py-1.5 text-right">{plan.active}</td>
                  <td className="px-2 py-1.5 text-right">{plan.trialing}</td>
                  <td className="px-2 py-1.5 text-right">{plan.pastDue}</td>
                  <td className="py-1.5 pl-2 text-right">{plan.mrrPence > 0 ? formatCount(plan.mrrPence, "gbp") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Last 30 days: {billing.newSubscriptions30d} new · {billing.cancellations30d} cancelled ·{" "}
        <span className={billing.paymentsFailed30d > 0 ? "font-medium text-destructive" : undefined}>{billing.paymentsFailed30d} failed payments</span>
      </p>
    </Panel>
  );
}

// ---- AI ----------------------------------------------------------------------

export function AiPanel({ ai }: { ai: AdminOverview["ai"] }) {
  const tokens = ai.inputTokens30d + ai.outputTokens30d;
  return (
    <Panel
      title="AI usage & cost (30 days)"
      description="Cost is estimated from the pricing table in src/lib/ai/config.ts, not Anthropic's invoice."
      action={
        <Link href="/admin/ai-usage" className="text-xs font-medium text-primary hover:underline">
          Details
        </Link>
      }
    >
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Est. cost" value={formatCount(ai.costUsd30d, "usd")} />
        <Stat label="Calls" value={ai.calls30d.toLocaleString("en-GB")} />
        <Stat label="Success rate" value={ai.successRate === null ? "—" : `${ai.successRate}%`} hint={ai.failed30d > 0 ? `${ai.failed30d} failed` : undefined} />
        <Stat label="Tokens" value={compactNumber(tokens)} hint={`${compactNumber(ai.inputTokens30d)} in · ${compactNumber(ai.outputTokens30d)} out`} />
      </dl>

      {ai.topOperations.length === 0 ? (
        <p className="text-sm text-muted-foreground">No AI calls in the last 30 days.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1.5 pr-3 font-medium">Top operations by cost</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Calls</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Failed</th>
                <th scope="col" className="py-1.5 pl-2 text-right font-medium">Est. cost</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ai.topOperations.map((row) => (
                <tr key={row.operation} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">{row.operation}</th>
                  <td className="px-2 py-1.5 text-right">{row.calls.toLocaleString("en-GB")}</td>
                  <td className={cn("px-2 py-1.5 text-right", row.failed > 0 && "text-destructive")}>{row.failed}</td>
                  <td className="py-1.5 pl-2 text-right">{formatCount(row.costUsd, "usd")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

// ---- applications funnel + product ---------------------------------------------

const APPLICATION_STAGES: { key: string; label: string; className: string }[] = [
  { key: "wishlist", label: "Wishlist", className: "bg-muted-foreground/60" },
  { key: "applied", label: "Applied", className: "bg-primary" },
  { key: "interview", label: "Interview", className: "bg-primary" },
  { key: "offer", label: "Offer", className: "bg-success" },
  { key: "rejected", label: "Rejected", className: "bg-destructive/70" },
  { key: "withdrawn", label: "Withdrawn", className: "bg-muted-foreground/40" },
];

export function ApplicationsPanel({ product }: { product: AdminOverview["product"] }) {
  const total = Object.values(product.applicationsByStatus).reduce((sum, value) => sum + value, 0);
  return (
    <Panel title="Applications by stage" description="Every tracked application across all users, by current status.">
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No applications are being tracked yet.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {APPLICATION_STAGES.map((stage, index) => {
            const count = product.applicationsByStatus[stage.key] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <li key={stage.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span>{stage.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    <span className="font-medium text-foreground">{count.toLocaleString("en-GB")}</span> · {pct.toFixed(0)}%
                  </span>
                </div>
                <AnimatedBar value={pct} delay={index * 0.06} barClassName={stage.className} />
              </li>
            );
          })}
        </ul>
      )}
      <dl className="grid grid-cols-3 gap-4 border-t pt-3">
        <Stat label="CVs" value={product.cvs.toLocaleString("en-GB")} hint={product.cvsArchived > 0 ? `${product.cvsArchived} archived` : undefined} />
        <Stat label="Cover letters" value={product.coverLetters.toLocaleString("en-GB")} />
        <Stat
          label="Avg ATS match (30d)"
          value={product.atsAvgMatch30d === null ? "—" : `${product.atsAvgMatch30d}%`}
        />
      </dl>
    </Panel>
  );
}

// ---- institutions ----------------------------------------------------------------

export function InstitutionsPanel({ institutions, showLink }: { institutions: InstitutionOverview; showLink: boolean }) {
  const usage = institutions.seatsLicensed > 0 ? Math.min(100, (institutions.members / institutions.seatsLicensed) * 100) : 0;
  return (
    <Panel
      title="Institutions"
      description="Universities and partners on a licence."
      action={
        showLink ? (
          <Link href="/admin/institutions" className="text-xs font-medium text-primary hover:underline">
            Manage
          </Link>
        ) : undefined
      }
    >
      {institutions.total === 0 ? (
        <p className="text-sm text-muted-foreground">No institutions have been set up yet.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Institutions" value={institutions.total.toLocaleString("en-GB")} />
            <Stat label="Active licences" value={institutions.activeLicences.toLocaleString("en-GB")} />
            <Stat label="Seats licensed" value={institutions.seatsLicensed.toLocaleString("en-GB")} />
            <Stat label="Members" value={institutions.members.toLocaleString("en-GB")} />
          </dl>
          {institutions.seatsLicensed > 0 && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>Seat use across active licences</span>
                <span className="tabular-nums">
                  {institutions.members.toLocaleString("en-GB")} of {institutions.seatsLicensed.toLocaleString("en-GB")} · {usage.toFixed(0)}%
                </span>
              </div>
              <AnimatedBar value={usage} />
            </div>
          )}
          {institutions.expiring30d > 0 && (
            <p className="text-xs font-medium text-warning">
              {institutions.expiring30d} licence{institutions.expiring30d === 1 ? "" : "s"} expiring within 30 days
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

// ---- sync pipelines --------------------------------------------------------------

function SyncRow({ name, state, detail, error }: { name: string; state: SyncState; detail: string; error: string | null }) {
  const meta = SYNC_TONE[state];
  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{name}</span>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>
      <p className="text-xs text-muted-foreground">{detail}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </li>
  );
}

export function PipelinesPanel({
  sources,
  activeListings,
  sponsors,
  links,
}: {
  sources: JobSourceSync[];
  activeListings: number | null;
  sponsors: SponsorSync;
  links: { jobs: boolean; sponsors: boolean };
}) {
  return (
    <Panel
      title="Sync pipelines"
      description={`${activeListings === null ? "" : `${activeListings.toLocaleString("en-GB")} live job listings. `}Sources are stale after 24 hours without a completed run.`}
    >
      <ul className="flex flex-col divide-y">
        {sources.length === 0 ? (
          <li className="py-2 text-sm text-muted-foreground">No job feed sources are configured.</li>
        ) : (
          sources.map((source) => (
            <SyncRow
              key={source.sourceName}
              name={`Jobs · ${source.sourceName}`}
              state={source.state}
              error={source.error}
              detail={
                source.lastCompletedAt
                  ? `Last completed ${timeAgo(source.lastCompletedAt)} (${formatDateTime(source.lastCompletedAt)})${
                      source.created !== null ? ` · +${source.created} new, ${source.updated ?? 0} updated` : ""
                    }`
                  : "No completed run yet."
              }
            />
          ))
        )}
        <SyncRow
          name="Sponsor register"
          state={sponsors.state}
          error={sponsors.error}
          detail={
            sponsors.lastCompletedAt
              ? `Last completed ${timeAgo(sponsors.lastCompletedAt)} (${formatDateTime(sponsors.lastCompletedAt)})${
                  sponsors.sponsorCount !== null ? ` · ${sponsors.sponsorCount.toLocaleString("en-GB")} sponsors` : ""
                }${
                  sponsors.added !== null
                    ? ` · +${sponsors.added} added, ${sponsors.reactivated ?? 0} reactivated, ${sponsors.deactivated ?? 0} deactivated`
                    : ""
                }`
              : "No sponsor import has completed yet."
          }
        />
      </ul>
      {(links.jobs || links.sponsors) && (
        <div className="flex gap-4 text-xs font-medium">
          {links.jobs && (
            <Link href="/admin/jobs" className="text-primary hover:underline">
              Job feed
            </Link>
          )}
          {links.sponsors && (
            <Link href="/admin/sponsors" className="text-primary hover:underline">
              Sponsor sync
            </Link>
          )}
        </div>
      )}
    </Panel>
  );
}

// ---- failures --------------------------------------------------------------------

const FAILURE_LABEL: Record<FailureSource, string> = {
  ai: "AI",
  job_sync: "Job sync",
  sponsor_sync: "Sponsor sync",
  email: "Email",
  webhook: "Stripe webhook",
};

export function FailuresPanel({ counts, recent }: { counts: FailureCounts7d | null; recent: RecentFailure[] }) {
  const tiles: { label: string; value: number | null; hint?: string }[] = [
    { label: "Job sync runs", value: counts ? counts.jobSync : null },
    { label: "Sponsor imports", value: counts ? counts.sponsorSync : null },
    { label: "Stripe webhooks", value: counts ? counts.webhooksUnresolved : null, hint: "still failing" },
    { label: "Failed payments", value: counts ? counts.payments : null },
    { label: "Emails", value: counts ? counts.emails : null },
    { label: "AI calls", value: counts ? counts.aiCalls : null },
  ];
  return (
    <Panel title="Failed jobs & webhooks (7 days)" description="Only failures this app actually records. ATS scans and interviews don't store failed attempts.">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border px-3 py-2">
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd
              className={cn(
                "font-heading text-xl font-semibold tabular-nums",
                tile.value === null ? "text-muted-foreground" : tile.value > 0 ? "text-destructive" : "text-foreground",
              )}
            >
              {tile.value === null ? "—" : tile.value.toLocaleString("en-GB")}
              {tile.value !== null && tile.hint && tile.value > 0 && (
                <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{tile.hint}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {recent.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-4 text-success" aria-hidden /> No recorded failures.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {recent.map((failure) => (
            <li key={`${failure.source}-${failure.id}`} className="flex items-start gap-3 py-2">
              <span className="mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] font-medium">{FAILURE_LABEL[failure.source]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm break-words">{failure.message}</p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(failure.occurredAt)}
                  {failure.resolved !== undefined && (failure.resolved ? " · resolved by a later retry" : " · unresolved")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---- health + activity ---------------------------------------------------------------

export function HealthPanel({ checks }: { checks: HealthCheckResult[] }) {
  const worst: HealthStatus = checks.some((c) => c.status === "down")
    ? "down"
    : checks.some((c) => c.status === "degraded")
      ? "degraded"
      : "operational";
  const overall = HEALTH_TONE[worst];
  return (
    <Panel
      title="System health"
      description={`Checked ${timeAgo(checks[0]?.checkedAt ?? null)}.`}
      action={
        <div className="flex items-center gap-3">
          <StatusPill tone={overall.tone}>{worst === "operational" ? "All systems operational" : overall.label}</StatusPill>
          <Link href="/admin/system-health" className="text-xs font-medium text-primary hover:underline">
            Details
          </Link>
        </div>
      }
    >
      <ul className="flex flex-col divide-y">
        {checks.map((check) => {
          const meta = HEALTH_TONE[check.status];
          return (
            <li key={check.key} className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm">{check.label}</span>
              <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

export function ActivityPanel({ entries }: { entries: AdminAuditLogEntry[] }) {
  return (
    <Panel
      title="Recent admin activity"
      action={
        <Link href="/admin/audit-log" className="text-xs font-medium text-primary hover:underline">
          Audit log
        </Link>
      }
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admin actions have been logged yet.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium break-words">{entry.action}</p>
                <p className="text-xs break-words text-muted-foreground">
                  {entry.actorEmail ?? "Unknown admin"} · {entry.entityType}
                </p>
              </div>
              <time dateTime={entry.createdAt} title={formatDateTime(entry.createdAt)} className="shrink-0 text-xs text-muted-foreground">
                {timeAgo(entry.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
