import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiUsageFilters, AiUsageDashboardData, AiUsageBreakdownRow, AiUsageUserBreakdownRow, AiUsageFailure } from "@/lib/admin/ai-usage/types";

// ai_usage_logs is self-select-only RLS (migration 0021) — every read
// here needs the service-role client, same as every other cross-user
// admin aggregate in this app.
//
// The sample cap: totalCalls/successRate below come from real COUNT
// queries over the *entire* date range, but the per-row breakdowns
// (by feature/model/user, total cost/tokens, avg latency, the failure
// list) all need the actual rows, and there's no server-side GROUP BY/
// SUM through the plain PostgREST query builder. 5,000 most-recent
// rows is a generous sample for this pre-launch app's actual volume;
// AiUsageSummary.truncated tells the UI when the range holds more than
// that, so a real cost/latency figure is never silently presented as
// if it covered calls it didn't.
const SAMPLE_CAP = 5000;
const TOP_USERS_LIMIT = 20;
const FAILURES_LIMIT = 20;

type UsageRow = {
  id: string;
  user_id: string | null;
  operation: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  success: boolean;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
};

/** The day *after* `dateOnly`, midnight UTC — used as an exclusive upper bound so a "to" date of e.g. 2026-03-05 still includes every call made during that whole day. */
function toExclusiveEndOfDay(dateOnly: string): string {
  const startOfDay = new Date(`${dateOnly}T00:00:00.000Z`);
  return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildBreakdown(rows: UsageRow[], keyOf: (row: UsageRow) => string): AiUsageBreakdownRow[] {
  const groups = new Map<string, UsageRow[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  return Array.from(groups.entries())
    .map(([key, groupRows]) => {
      const successCount = groupRows.filter((row) => row.success).length;
      const latencies = groupRows.map((row) => row.duration_ms).filter((value): value is number => value !== null);
      return {
        key,
        calls: groupRows.length,
        successRate: groupRows.length > 0 ? Math.round((successCount / groupRows.length) * 100) : null,
        costUsd: groupRows.reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0),
        tokens: groupRows.reduce((sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0), 0),
        avgLatencyMs: average(latencies),
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd);
}

export async function getAiUsageDashboard(filters: AiUsageFilters): Promise<AiUsageDashboardData> {
  const admin = createAdminClient();
  const fromIso = new Date(`${filters.from}T00:00:00.000Z`).toISOString();
  const toIso = toExclusiveEndOfDay(filters.to);

  const [{ count: totalCalls }, { count: successCount }, { data: rowsData }] = await Promise.all([
    admin.from("ai_usage_logs").select("id", { count: "exact", head: true }).gte("created_at", fromIso).lt("created_at", toIso),
    admin
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .eq("success", true),
    admin
      .from("ai_usage_logs")
      .select("id, user_id, operation, model, input_tokens, output_tokens, estimated_cost_usd, success, error_message, duration_ms, created_at")
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(SAMPLE_CAP),
  ]);

  const rows = (rowsData ?? []) as UsageRow[];
  const sampledRows = rows.length;
  const truncated = (totalCalls ?? 0) > sampledRows;

  const latencies = rows.map((row) => row.duration_ms).filter((value): value is number => value !== null);
  const summary = {
    totalCalls: totalCalls ?? 0,
    successRate: totalCalls ? Math.round(((successCount ?? 0) / totalCalls) * 100) : null,
    sampledRows,
    truncated,
    totalCostUsd: rows.reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0),
    totalTokens: rows.reduce((sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0), 0),
    avgLatencyMs: average(latencies),
  };

  const byFeature = buildBreakdown(rows, (row) => row.operation);
  const byModel = buildBreakdown(rows, (row) => row.model);

  const byUserRaw = buildBreakdown(rows, (row) => row.user_id ?? "anonymous").slice(0, TOP_USERS_LIMIT);
  const userIds = byUserRaw.map((entry) => entry.key).filter((key) => key !== "anonymous");
  const emailById = new Map<string, string | null>();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      emailById.set(userId, data.user?.email ?? null);
    }),
  );
  const byUser: AiUsageUserBreakdownRow[] = byUserRaw.map((entry) => ({
    ...entry,
    userId: entry.key === "anonymous" ? null : entry.key,
    email: entry.key === "anonymous" ? null : emailById.get(entry.key) ?? null,
  }));

  const failures: AiUsageFailure[] = rows
    .filter((row) => !row.success)
    .slice(0, FAILURES_LIMIT)
    .map((row) => ({
      id: row.id,
      operation: row.operation,
      model: row.model,
      errorMessage: row.error_message,
      occurredAt: row.created_at,
    }));

  return { summary, byFeature, byModel, byUser, failures };
}
