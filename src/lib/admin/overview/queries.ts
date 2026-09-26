import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { deriveSponsorSyncState } from "@/lib/admin/sponsors/sync-state";
import type {
  AdminOverview,
  BillingOverview,
  DailyPoint,
  FailureCounts7d,
  InstitutionOverview,
  JobSourceSync,
  RecentFailure,
  SponsorSync,
  SubscriptionPlanRow,
  SyncState,
  WindowTotals,
} from "@/lib/admin/overview/types";

// Same 4x the 6-hourly cron interval src/lib/health/checks.ts uses, so the
// overview and the health page never disagree about what "stale" means.
const STALE_SYNC_HOURS = 24;
const CHART_DAYS = 30;
const MAX_MESSAGE_LENGTH = 220;

const num = z.coerce.number().catch(0);

const dailyRowSchema = z.object({
  day: z.string(),
  new_users: num,
  active_users: num,
  ai_calls: num,
  ai_failed: num,
  ai_cost_usd: num,
  ats_scans: num,
  interviews: num,
  cvs_created: num,
  applications_created: num,
});

const snapshotSchema = z.object({
  active_users: z.object({ d1: num, d7: num, d30: num }),
  subscriptions: z.array(
    z.object({
      plan_slug: z.string(),
      plan_name: z.string(),
      tier_order: num,
      monthly_price_pence: num,
      annual_price_pence: num,
      status: z.string(),
      billing_cycle: z.string().nullable(),
      stripe_billed: z.boolean().catch(false),
      count: num,
    }),
  ),
  billing_events_30d: z.record(z.string(), num),
  totals: z.object({
    users: num,
    cvs: num,
    cvs_archived: num,
    ats_scans: num,
    ats_avg_match_30d: z.coerce.number().nullable().catch(null),
    interviews: num,
    interviews_completed: num,
    applications: num,
    cover_letters: num,
    jobs_active: num,
  }),
  applications_by_status: z.record(z.string(), num),
  ai_30d: z.object({
    input_tokens: num,
    output_tokens: num,
    top_operations: z.array(z.object({ operation: z.string(), calls: num, failed: num, cost_usd: num })),
  }),
  institutions: z.object({ total: num, active_licences: num, seats_licensed: num, members: num, expiring_30d: num }),
  failures_7d: z.object({
    job_sync: num,
    sponsor_sync: num,
    emails: num,
    ai_calls: num,
    payments: num,
    webhooks_unresolved: num,
  }),
});

function sumWindow(points: DailyPoint[]): WindowTotals {
  return points.reduce<WindowTotals>(
    (total, point) => ({
      newUsers: total.newUsers + point.newUsers,
      aiCalls: total.aiCalls + point.aiCalls,
      aiFailed: total.aiFailed + point.aiFailed,
      aiCostUsd: total.aiCostUsd + point.aiCostUsd,
      atsScans: total.atsScans + point.atsScans,
      interviews: total.interviews + point.interviews,
      cvsCreated: total.cvsCreated + point.cvsCreated,
      applicationsCreated: total.applicationsCreated + point.applicationsCreated,
    }),
    { newUsers: 0, aiCalls: 0, aiFailed: 0, aiCostUsd: 0, atsScans: 0, interviews: 0, cvsCreated: 0, applicationsCreated: 0 },
  );
}

export function summariseBilling(
  rows: z.infer<typeof snapshotSchema>["subscriptions"],
  events: Record<string, number>,
): BillingOverview {
  const byPlan = new Map<string, SubscriptionPlanRow>();
  const overall = { activePaid: 0, complimentary: 0, trialing: 0, pastDue: 0, incomplete: 0, canceled: 0, mrrPence: 0 };

  for (const row of rows) {
    const plan =
      byPlan.get(row.plan_slug) ??
      { slug: row.plan_slug, name: row.plan_name, tierOrder: row.tier_order, active: 0, trialing: 0, pastDue: 0, canceled: 0, mrrPence: 0 };
    const isPaid = row.tier_order > 0;

    if (row.status === "active") {
      plan.active += row.count;
      if (isPaid && !row.stripe_billed) {
        // On a paid plan but nothing is being charged (an access code or a complimentary grant): not revenue.
        overall.complimentary += row.count;
      } else if (isPaid) {
        const monthly = row.billing_cycle === "annual" ? Math.round(row.annual_price_pence / 12) : row.monthly_price_pence;
        plan.mrrPence += monthly * row.count;
        overall.activePaid += row.count;
        overall.mrrPence += monthly * row.count;
      }
    } else if (row.status === "trialing") {
      plan.trialing += row.count;
      overall.trialing += row.count;
    } else if (row.status === "past_due") {
      plan.pastDue += row.count;
      overall.pastDue += row.count;
    } else if (row.status === "canceled") {
      plan.canceled += row.count;
      overall.canceled += row.count;
    } else if (row.status === "incomplete") {
      overall.incomplete += row.count;
    }
    byPlan.set(row.plan_slug, plan);
  }

  return {
    ...overall,
    arrPence: overall.mrrPence * 12,
    byPlan: [...byPlan.values()].sort((a, b) => a.tierOrder - b.tierOrder),
    paymentsFailed30d: events["payment_failed"] ?? 0,
    newSubscriptions30d: events["subscription_created"] ?? 0,
    cancellations30d: events["subscription_canceled"] ?? 0,
  };
}

function syncState(latestStatus: string | null, lastCompletedAt: string | null): SyncState {
  if (!latestStatus && !lastCompletedAt) return "never";
  if (latestStatus === "failed") return "failed";
  if (!lastCompletedAt) return "never";
  return Date.now() - new Date(lastCompletedAt).getTime() > STALE_SYNC_HOURS * 60 * 60 * 1000 ? "stale" : "ok";
}

function clip(message: string | null | undefined, fallback: string): string {
  const text = (message ?? "").trim() || fallback;
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}…` : text;
}

type JobRunRow = {
  source_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  fetched_count: number | null;
  created_count: number | null;
  updated_count: number | null;
  error_message: string | null;
};

async function getJobSources(): Promise<JobSourceSync[]> {
  const admin = createAdminClient();
  const { data: sources } = await admin.from("job_sources").select("id, slug, name").eq("is_active", true).order("name");
  // "manual" holds hand-entered listings — it has no feed to sync, so it would only ever read "never".
  const feeds = (sources ?? []).filter((source) => source.slug !== "manual");
  if (feeds.length === 0) return [];

  const { data: runs } = await admin
    .from("job_imports")
    .select("source_id, status, started_at, completed_at, fetched_count, created_count, updated_count, error_message")
    .eq("run_type", "sync")
    .in("source_id", feeds.map((source) => source.id))
    .order("started_at", { ascending: false })
    .limit(feeds.length * 8);

  return feeds.map((source) => {
    const own = ((runs ?? []) as JobRunRow[]).filter((run) => run.source_id === source.id);
    const latest = own[0] ?? null;
    const lastCompleted = own.find((run) => run.status === "completed") ?? null;
    return {
      sourceName: source.name,
      state: syncState(latest?.status ?? null, lastCompleted?.completed_at ?? null),
      lastRunAt: latest?.started_at ?? null,
      lastCompletedAt: lastCompleted?.completed_at ?? null,
      fetched: lastCompleted?.fetched_count ?? null,
      created: lastCompleted?.created_count ?? null,
      updated: lastCompleted?.updated_count ?? null,
      error: latest?.status === "failed" ? clip(latest.error_message, "Run failed (no error message recorded)") : null,
    };
  });
}

async function getSponsorSync(): Promise<SponsorSync> {
  const admin = createAdminClient();
  const [{ data: status }, { data: latest }] = await Promise.all([
    admin
      .from("sponsor_sync_status")
      .select("completed_at, sponsor_count, added_count, reactivated_count, deactivated_count")
      .maybeSingle(),
    admin.from("sponsor_imports").select("status, started_at, error_message").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    // The sponsor register syncs daily but is only republished on working days, so it has its own (36h) staleness
    // window and stuck-run detection — shared with the /admin/sponsors page so the two can't disagree.
    state: deriveSponsorSyncState({
      latestStatus: latest?.status ?? null,
      latestStartedAt: latest?.started_at ?? null,
      lastCompletedAt: status?.completed_at ?? null,
    }),
    lastCompletedAt: status?.completed_at ?? null,
    sponsorCount: status?.sponsor_count ?? null,
    added: status?.added_count ?? null,
    reactivated: status?.reactivated_count ?? null,
    deactivated: status?.deactivated_count ?? null,
    error: latest?.status === "failed" ? clip(latest.error_message, "Import failed (no error message recorded)") : null,
  };
}

/**
 * The failures that actually persist somewhere in this schema, merged
 * newest-first: failed AI calls, failed job/sponsor sync runs, failed
 * email sends and failed Stripe webhook deliveries. ATS scans and
 * interview sessions never store a failed attempt, so they can't appear
 * here — absent by design, not missed.
 */
async function getRecentFailures(limit: number): Promise<RecentFailure[]> {
  const admin = createAdminClient();
  const [ai, jobs, sponsors, emails, webhooks] = await Promise.all([
    admin.from("ai_usage_logs").select("id, operation, error_message, created_at").eq("success", false).order("created_at", { ascending: false }).limit(limit),
    admin.from("job_imports").select("id, error_message, started_at, job_sources(name)").eq("status", "failed").order("started_at", { ascending: false }).limit(limit),
    admin.from("sponsor_imports").select("id, error_message, started_at").eq("status", "failed").order("started_at", { ascending: false }).limit(limit),
    admin.from("email_send_logs").select("id, template, error_name, created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(limit),
    admin.from("stripe_webhook_failures").select("id, event_type, error_message, created_at, resolved_at").order("created_at", { ascending: false }).limit(limit),
  ]);

  const rows: RecentFailure[] = [
    ...(ai.data ?? []).map((row) => ({
      id: row.id,
      source: "ai" as const,
      message: `${row.operation}: ${clip(row.error_message, "call failed (no error message recorded)")}`,
      occurredAt: row.created_at,
    })),
    ...(jobs.data ?? []).map((row) => {
      const relation = row.job_sources as { name: string }[] | { name: string } | null;
      const name = (Array.isArray(relation) ? relation[0]?.name : relation?.name) ?? "Job sync";
      return { id: row.id, source: "job_sync" as const, message: `${name}: ${clip(row.error_message, "run failed (no error message recorded)")}`, occurredAt: row.started_at };
    }),
    ...(sponsors.data ?? []).map((row) => ({
      id: row.id,
      source: "sponsor_sync" as const,
      message: clip(row.error_message, "Sponsor import failed (no error message recorded)"),
      occurredAt: row.started_at,
    })),
    ...(emails.data ?? []).map((row) => ({
      id: row.id,
      source: "email" as const,
      message: `${row.template}: send failed${row.error_name ? ` (${row.error_name})` : ""}`,
      occurredAt: row.created_at,
    })),
    ...(webhooks.data ?? []).map((row) => ({
      id: row.id,
      source: "webhook" as const,
      message: `${row.event_type}: ${clip(row.error_message, "processing failed")}`,
      occurredAt: row.created_at,
      resolved: row.resolved_at !== null,
    })),
  ];

  return rows.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, limit);
}

const EMPTY_SNAPSHOT = snapshotSchema.parse({
  active_users: {},
  subscriptions: [],
  billing_events_30d: {},
  totals: {},
  applications_by_status: {},
  ai_30d: { top_operations: [] },
  institutions: {},
  failures_7d: {},
});

/**
 * Everything the admin overview shows, in parallel. Aggregates come from
 * two SQL functions (migration 0091) so the cost stays flat as tables
 * grow; sync status and recent failures are small direct reads. The
 * service-role client is required throughout because these tables are
 * self-select only under RLS — this whole module sits behind
 * `requireAdmin()` (src/app/admin/layout.tsx).
 *
 * If a function errors (e.g. migration 0090/0091 not applied yet) that
 * section renders as zero and `loadError` says so — the overview never
 * dresses a failed query up as real data.
 */
export async function getAdminOverview(): Promise<{ overview: AdminOverview; loadError: string | null }> {
  const admin = createAdminClient();
  const [dailyResult, snapshotResult, breakdownResult, jobSources, sponsors, recentFailures] = await Promise.all([
    admin.rpc("admin_overview_daily", { p_days: CHART_DAYS * 2 }),
    admin.rpc("admin_overview_snapshot"),
    admin.rpc("admin_subscription_breakdown"),
    getJobSources(),
    getSponsorSync(),
    getRecentFailures(8),
  ]);

  const errors: string[] = [];

  let allDaily: DailyPoint[] = [];
  if (dailyResult.error) {
    errors.push(`daily series (${dailyResult.error.message})`);
  } else {
    allDaily = z
      .array(dailyRowSchema)
      .parse(dailyResult.data ?? [])
      .map((row) => ({
        day: row.day,
        newUsers: row.new_users,
        activeUsers: row.active_users,
        aiCalls: row.ai_calls,
        aiFailed: row.ai_failed,
        aiCostUsd: row.ai_cost_usd,
        atsScans: row.ats_scans,
        interviews: row.interviews,
        cvsCreated: row.cvs_created,
        applicationsCreated: row.applications_created,
      }));
  }

  let snapshot = EMPTY_SNAPSHOT;
  let snapshotLoaded = false;
  if (snapshotResult.error) {
    errors.push(`totals (${snapshotResult.error.message})`);
  } else {
    const parsed = snapshotSchema.safeParse(snapshotResult.data);
    if (parsed.success) {
      snapshot = parsed.data;
      snapshotLoaded = true;
    } else {
      errors.push("totals (unexpected response shape)");
    }
  }

  // Subscriptions come from their own function (migration 0122) because it knows which ones Stripe actually bills.
  let subscriptions = snapshot.subscriptions.map((row) => ({ ...row, stripe_billed: false }));
  if (breakdownResult.error) {
    errors.push(`subscriptions (${breakdownResult.error.message})`);
    subscriptions = [];
  } else {
    const parsed = snapshotSchema.shape.subscriptions.safeParse(breakdownResult.data);
    if (parsed.success) subscriptions = parsed.data;
    else {
      errors.push("subscriptions (unexpected response shape)");
      subscriptions = [];
    }
  }

  const daily = allDaily.slice(-CHART_DAYS);
  const previousDaily = allDaily.slice(0, Math.max(0, allDaily.length - CHART_DAYS));
  const current = sumWindow(daily);
  const previous = sumWindow(previousDaily);

  const t = snapshot.totals;
  const institutions: InstitutionOverview = {
    total: snapshot.institutions.total,
    activeLicences: snapshot.institutions.active_licences,
    seatsLicensed: snapshot.institutions.seats_licensed,
    members: snapshot.institutions.members,
    expiring30d: snapshot.institutions.expiring_30d,
  };
  const failures7d: FailureCounts7d = {
    jobSync: snapshot.failures_7d.job_sync,
    sponsorSync: snapshot.failures_7d.sponsor_sync,
    emails: snapshot.failures_7d.emails,
    aiCalls: snapshot.failures_7d.ai_calls,
    payments: snapshot.failures_7d.payments,
    webhooksUnresolved: snapshot.failures_7d.webhooks_unresolved,
  };

  const overview: AdminOverview = {
    generatedAt: new Date().toISOString(),
    loaded: { daily: !dailyResult.error, snapshot: snapshotLoaded },
    daily,
    current,
    previous,
    users: {
      total: t.users,
      new7d: daily.slice(-7).reduce((sum, point) => sum + point.newUsers, 0),
      new30d: current.newUsers,
      active1d: snapshot.active_users.d1,
      active7d: snapshot.active_users.d7,
      active30d: snapshot.active_users.d30,
    },
    billing: summariseBilling(subscriptions, snapshot.billing_events_30d),
    ai: {
      calls30d: current.aiCalls,
      failed30d: current.aiFailed,
      successRate: current.aiCalls > 0 ? Math.round(((current.aiCalls - current.aiFailed) / current.aiCalls) * 1000) / 10 : null,
      costUsd30d: current.aiCostUsd,
      inputTokens30d: snapshot.ai_30d.input_tokens,
      outputTokens30d: snapshot.ai_30d.output_tokens,
      topOperations: snapshot.ai_30d.top_operations.map((row) => ({ operation: row.operation, calls: row.calls, failed: row.failed, costUsd: row.cost_usd })),
    },
    product: {
      cvs: t.cvs,
      cvsArchived: t.cvs_archived,
      atsScans: t.ats_scans,
      atsAvgMatch30d: t.ats_avg_match_30d,
      interviews: t.interviews,
      interviewsCompleted: t.interviews_completed,
      applications: t.applications,
      coverLetters: t.cover_letters,
      applicationsByStatus: snapshot.applications_by_status,
    },
    institutions,
    jobs: { activeListings: t.jobs_active, sources: jobSources },
    sponsors,
    failures7d,
    recentFailures,
  };

  return { overview, loadError: errors.length > 0 ? `Some figures couldn't be loaded: ${errors.join("; ")}. Have migrations 0090, 0091 and 0122 been applied?` : null };
}
