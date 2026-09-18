export type AiUsageFilters = {
  /** Inclusive, "YYYY-MM-DD", local to the server (this is an internal ops dashboard, not user-facing — no timezone-detection ceremony needed here). */
  from: string;
  to: string;
};

export type AiUsageSummary = {
  /** Real counts across the *entire* date range (a plain COUNT query, never sample-based) — distinct from the sums/averages below, which run over `sampledRows` and are flagged with `truncated` when the range holds more than that sample. */
  totalCalls: number;
  successRate: number | null;
  sampledRows: number;
  truncated: boolean;
  totalCostUsd: number;
  totalTokens: number;
  avgLatencyMs: number | null;
};

export type AiUsageBreakdownRow = {
  key: string;
  calls: number;
  successRate: number | null;
  costUsd: number;
  tokens: number;
  avgLatencyMs: number | null;
};

export type AiUsageUserBreakdownRow = AiUsageBreakdownRow & {
  userId: string | null;
  email: string | null;
};

export type AiUsageFailure = {
  id: string;
  operation: string;
  model: string;
  errorMessage: string | null;
  occurredAt: string;
};

export type AiUsageDashboardData = {
  summary: AiUsageSummary;
  byFeature: AiUsageBreakdownRow[];
  byModel: AiUsageBreakdownRow[];
  byUser: AiUsageUserBreakdownRow[];
  failures: AiUsageFailure[];
};
