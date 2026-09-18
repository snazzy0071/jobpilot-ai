// Types for the platform-wide admin overview
// (src/lib/admin/overview/queries.ts) — every number here is a real
// aggregate over this app's own tables, nothing fabricated. Where a
// pipeline has genuinely never run yet (sponsor sync has no cron job
// wired up as of this app's own schema comments), the corresponding
// status field is `null`, rendered as "never run" rather than a fake
// zero.

export type AdminUserMetrics = {
  totalUsers: number;
  newUsersLast30Days: number;
};

/**
 * `mrrPence` is deliberately narrow: the sum of monthly-equivalent
 * price (an annual subscription's `annual_price_pence / 12`) across
 * subscriptions with `status = 'active'` on a non-free plan only —
 * `trialing` and `past_due` are reported as separate counts, not
 * folded into the dollar figure, since neither is confirmed recurring
 * revenue yet (a trial hasn't been charged; a past_due payment already
 * failed once).
 */
export type AdminBillingMetrics = {
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  mrrPence: number;
};

/** A rolling 30-day window, not a lifetime sum — ai_usage_logs has no upper bound on row count, so an all-time cost query would only get more expensive to run over the app's life for a number that matters less than "what's this costing right now". */
export type AdminAiUsageMetrics = {
  callsLast30Days: number;
  successRateLast30Days: number | null;
  costLast30DaysUsd: number;
};

export type AdminAtsScanMetrics = {
  totalScans: number;
  scansLast30Days: number;
};

export type AdminInterviewMetrics = {
  totalSessions: number;
  completedSessions: number;
  sessionsLast30Days: number;
};

export type JobSourceSyncStatus = {
  sourceName: string;
  lastCompletedAt: string | null;
  fetchedCount: number | null;
  createdCount: number | null;
  updatedCount: number | null;
};

export type AdminSponsorSyncStatus = {
  lastCompletedAt: string | null;
  sponsorCount: number | null;
  addedCount: number | null;
  reactivatedCount: number | null;
  deactivatedCount: number | null;
};

export type RecentAdminError = {
  id: string;
  source: "ai" | "job_sync" | "sponsor_sync";
  message: string;
  occurredAt: string;
};
