// Types for the platform-wide admin overview
// (src/lib/admin/overview/queries.ts). Every number is a real aggregate
// over this app's own tables — nothing is estimated, seeded or padded.
// Where a pipeline has never run (or a table is empty) the value is
// `null`/0 and the UI says so, rather than showing a plausible-looking
// figure.

/** One UTC day of platform activity (from `admin_overview_daily`, migration 0091). */
export type DailyPoint = {
  day: string; // YYYY-MM-DD, UTC
  newUsers: number;
  activeUsers: number;
  aiCalls: number;
  aiFailed: number;
  aiCostUsd: number;
  atsScans: number;
  interviews: number;
  cvsCreated: number;
  applicationsCreated: number;
};

export type WindowTotals = {
  newUsers: number;
  aiCalls: number;
  aiFailed: number;
  aiCostUsd: number;
  atsScans: number;
  interviews: number;
  cvsCreated: number;
  applicationsCreated: number;
};

export type SubscriptionPlanRow = {
  slug: string;
  name: string;
  tierOrder: number;
  /** Active subscriptions on this plan (the free plan included; it just has no revenue). */
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  mrrPence: number;
};

export type BillingOverview = {
  /** Monthly-equivalent revenue: active subscriptions on a paid plan only (a trial hasn't been charged; a past-due payment already failed once). */
  mrrPence: number;
  arrPence: number;
  /** Active subscriptions on a paid plan that Stripe is billing. */
  activePaid: number;
  /** Active on a paid plan but not billed (access-code or complimentary grants): shown, never counted as revenue. */
  complimentary: number;
  trialing: number;
  pastDue: number;
  incomplete: number;
  canceled: number;
  byPlan: SubscriptionPlanRow[];
  /** From the billing_events ledger, last 30 days. */
  paymentsFailed30d: number;
  newSubscriptions30d: number;
  cancellations30d: number;
};

export type AiOperationRow = { operation: string; calls: number; failed: number; costUsd: number };

export type InstitutionOverview = {
  total: number;
  activeLicences: number;
  seatsLicensed: number;
  members: number;
  expiring30d: number;
};

export type FailureCounts7d = {
  jobSync: number;
  sponsorSync: number;
  emails: number;
  aiCalls: number;
  payments: number;
  webhooksUnresolved: number;
};

export type SyncState = "ok" | "stale" | "failed" | "never" | "running";

export type JobSourceSync = {
  sourceName: string;
  state: SyncState;
  lastRunAt: string | null;
  lastCompletedAt: string | null;
  fetched: number | null;
  created: number | null;
  updated: number | null;
  error: string | null;
};

export type SponsorSync = {
  state: SyncState;
  lastCompletedAt: string | null;
  sponsorCount: number | null;
  added: number | null;
  reactivated: number | null;
  deactivated: number | null;
  error: string | null;
};

export type FailureSource = "ai" | "job_sync" | "sponsor_sync" | "email" | "webhook";

export type RecentFailure = {
  id: string;
  source: FailureSource;
  message: string;
  occurredAt: string;
  /** Webhook failures only: a later retry succeeded. */
  resolved?: boolean;
};

export type AdminOverview = {
  generatedAt: string;
  /** Which aggregate sources loaded. A source that failed is reported as unavailable, never as zero. */
  loaded: { daily: boolean; snapshot: boolean };
  /** The last 30 UTC days, oldest first. */
  daily: DailyPoint[];
  current: WindowTotals;
  previous: WindowTotals;
  users: {
    total: number;
    new7d: number;
    new30d: number;
    active1d: number;
    active7d: number;
    active30d: number;
  };
  billing: BillingOverview;
  ai: {
    calls30d: number;
    failed30d: number;
    successRate: number | null;
    costUsd30d: number;
    inputTokens30d: number;
    outputTokens30d: number;
    topOperations: AiOperationRow[];
  };
  product: {
    cvs: number;
    cvsArchived: number;
    atsScans: number;
    atsAvgMatch30d: number | null;
    interviews: number;
    interviewsCompleted: number;
    applications: number;
    coverLetters: number;
    applicationsByStatus: Record<string, number>;
  };
  institutions: InstitutionOverview;
  jobs: { activeListings: number; sources: JobSourceSync[] };
  sponsors: SponsorSync;
  failures7d: FailureCounts7d;
  recentFailures: RecentFailure[];
};
