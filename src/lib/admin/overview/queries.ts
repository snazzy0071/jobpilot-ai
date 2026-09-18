import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AdminUserMetrics,
  AdminBillingMetrics,
  AdminAiUsageMetrics,
  AdminAtsScanMetrics,
  AdminInterviewMetrics,
  JobSourceSyncStatus,
  AdminSponsorSyncStatus,
  RecentAdminError,
} from "@/lib/admin/overview/types";

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

function firstOf<T>(value: T[] | T | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

/** `profiles` has no "anyone can view" policy — only self-select — so a platform-wide count needs the service-role client, same reasoning every other cross-user admin count in this app already documents. */
export async function getUserMetrics(): Promise<AdminUserMetrics> {
  const admin = createAdminClient();
  const [{ count: totalUsers }, { count: newUsersLast30Days }] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", THIRTY_DAYS_AGO()),
  ]);
  return { totalUsers: totalUsers ?? 0, newUsersLast30Days: newUsersLast30Days ?? 0 };
}

type SubscriptionRow = {
  status: string;
  billing_cycle: string | null;
  plans: { slug: string; monthly_price_pence: number; annual_price_pence: number; tier_order: number }[] | { slug: string; monthly_price_pence: number; annual_price_pence: number; tier_order: number } | null;
};

/** `subscriptions`/`billing_events` are self-select only (migration 0015) — every subscription across every user needs the service-role client to read at all, let alone aggregate. */
export async function getBillingMetrics(): Promise<AdminBillingMetrics> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, billing_cycle, plans(slug, monthly_price_pence, annual_price_pence, tier_order)");
  if (error || !data) {
    return { activeSubscriptions: 0, trialingSubscriptions: 0, pastDueSubscriptions: 0, mrrPence: 0 };
  }

  let activeSubscriptions = 0;
  let trialingSubscriptions = 0;
  let pastDueSubscriptions = 0;
  let mrrPence = 0;

  for (const row of data as SubscriptionRow[]) {
    const plan = firstOf(row.plans);
    const isPaidPlan = !!plan && plan.tier_order > 0;

    if (row.status === "trialing") trialingSubscriptions++;
    if (row.status === "past_due") pastDueSubscriptions++;
    if (row.status === "active") {
      if (isPaidPlan) activeSubscriptions++;
      if (isPaidPlan && plan) {
        mrrPence += row.billing_cycle === "annual" ? Math.round(plan.annual_price_pence / 12) : plan.monthly_price_pence;
      }
    }
  }

  return { activeSubscriptions, trialingSubscriptions, pastDueSubscriptions, mrrPence };
}

/** `ai_usage_logs` is self-select only (migration 0021) — same reasoning as getBillingMetrics above. */
export async function getAiUsageMetrics(): Promise<AdminAiUsageMetrics> {
  const admin = createAdminClient();
  const cutoff = THIRTY_DAYS_AGO();

  const [{ count: callsLast30Days }, { count: successCalls }, { data: costRows }] = await Promise.all([
    admin.from("ai_usage_logs").select("id", { count: "exact", head: true }).gte("created_at", cutoff),
    admin.from("ai_usage_logs").select("id", { count: "exact", head: true }).gte("created_at", cutoff).eq("success", true),
    admin.from("ai_usage_logs").select("estimated_cost_usd").gte("created_at", cutoff),
  ]);

  const costLast30DaysUsd = (costRows ?? []).reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0);
  const successRateLast30Days = callsLast30Days ? Math.round(((successCalls ?? 0) / callsLast30Days) * 100) : null;

  return { callsLast30Days: callsLast30Days ?? 0, successRateLast30Days, costLast30DaysUsd };
}

/** `ats_scans` is self-select only (migration 0031) — same reasoning as above. */
export async function getAtsScanMetrics(): Promise<AdminAtsScanMetrics> {
  const admin = createAdminClient();
  const [{ count: totalScans }, { count: scansLast30Days }] = await Promise.all([
    admin.from("ats_scans").select("id", { count: "exact", head: true }),
    admin.from("ats_scans").select("id", { count: "exact", head: true }).gte("created_at", THIRTY_DAYS_AGO()),
  ]);
  return { totalScans: totalScans ?? 0, scansLast30Days: scansLast30Days ?? 0 };
}

/** `interview_sessions` is self-select only (migration 0040) — same reasoning as above. */
export async function getInterviewMetrics(): Promise<AdminInterviewMetrics> {
  const admin = createAdminClient();
  const [{ count: totalSessions }, { count: completedSessions }, { count: sessionsLast30Days }] = await Promise.all([
    admin.from("interview_sessions").select("id", { count: "exact", head: true }),
    admin.from("interview_sessions").select("id", { count: "exact", head: true }).eq("status", "completed"),
    admin.from("interview_sessions").select("id", { count: "exact", head: true }).gte("created_at", THIRTY_DAYS_AGO()),
  ]);
  return {
    totalSessions: totalSessions ?? 0,
    completedSessions: completedSessions ?? 0,
    sessionsLast30Days: sessionsLast30Days ?? 0,
  };
}

/**
 * `job_imports`/`job_sources` both carry "Anyone can view" policies
 * (migrations 0059/0060) — a real, already-running pipeline (Adzuna +
 * Reed cron sync), so the regular client is enough; reads the
 * `job_source_sync_status` view (last *completed* run per source)
 * rather than reimplementing that same "distinct on source_id, most
 * recent completed_at" query here.
 */
export async function getJobSyncStatus(): Promise<JobSourceSyncStatus[]> {
  const supabase = await createClient();
  const { data: sources, error: sourcesError } = await supabase.from("job_sources").select("id, name").eq("is_active", true);
  if (sourcesError || !sources) return [];

  const { data: statusRows } = await supabase
    .from("job_source_sync_status")
    .select("source_id, completed_at, fetched_count, created_count, updated_count");
  const statusBySource = new Map((statusRows ?? []).map((row) => [row.source_id, row]));

  return sources.map((source) => {
    const status = statusBySource.get(source.id);
    return {
      sourceName: source.name,
      lastCompletedAt: status?.completed_at ?? null,
      fetchedCount: status?.fetched_count ?? null,
      createdCount: status?.created_count ?? null,
      updatedCount: status?.updated_count ?? null,
    };
  });
}

/**
 * `sponsor_imports` also carries "Anyone can view" (migration 0049),
 * so the regular client is enough here too. This pipeline's own schema
 * comment says no ingestion job is actually wired up yet — a `null`
 * result here is the honest, expected state, not a bug.
 */
export async function getSponsorSyncStatus(): Promise<AdminSponsorSyncStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsor_sync_status")
    .select("completed_at, sponsor_count, added_count, reactivated_count, deactivated_count")
    .maybeSingle();
  if (error || !data) return null;
  return {
    lastCompletedAt: data.completed_at,
    sponsorCount: data.sponsor_count,
    addedCount: data.added_count,
    reactivatedCount: data.reactivated_count,
    deactivatedCount: data.deactivated_count,
  };
}

/**
 * Merges the only three domains that actually persist a failure
 * anywhere in this schema (ai_usage_logs.success/error_message,
 * job_imports.status='failed', sponsor_imports.status='failed') —
 * there's no generic error-log table to read from instead. ATS scans
 * and interview sessions never persist a failed attempt at all, so
 * they can't contribute to this list honestly; they're absent here on
 * purpose, not missed.
 */
export async function getRecentErrors(limit = 10): Promise<RecentAdminError[]> {
  const admin = createAdminClient();
  const supabase = await createClient();

  const [aiErrors, jobErrors, sponsorErrors] = await Promise.all([
    admin
      .from("ai_usage_logs")
      .select("id, error_message, created_at")
      .eq("success", false)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("job_imports")
      .select("id, error_message, started_at")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(limit),
    supabase
      .from("sponsor_imports")
      .select("id, error_message, started_at")
      .eq("status", "failed")
      .order("started_at", { ascending: false })
      .limit(limit),
  ]);

  const errors: RecentAdminError[] = [
    ...(aiErrors.data ?? []).map((row) => ({
      id: row.id,
      source: "ai" as const,
      message: row.error_message ?? "AI call failed (no error message recorded)",
      occurredAt: row.created_at,
    })),
    ...(jobErrors.data ?? []).map((row) => ({
      id: row.id,
      source: "job_sync" as const,
      message: row.error_message ?? "Job sync failed (no error message recorded)",
      occurredAt: row.started_at,
    })),
    ...(sponsorErrors.data ?? []).map((row) => ({
      id: row.id,
      source: "sponsor_sync" as const,
      message: row.error_message ?? "Sponsor sync failed (no error message recorded)",
      occurredAt: row.started_at,
    })),
  ];

  return errors.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, limit);
}
