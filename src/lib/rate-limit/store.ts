import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * `failed` is true when the counter itself couldn't be checked (the RPC
 * errored: wrong service-role key, migration missing, Supabase down).
 * In that case `allowed` is false (fail closed) — callers that would
 * rather fail open for a specific surface can check `failed` instead of
 * treating a broken store as "this caller is over the limit".
 */
export type RateLimitOutcome = { allowed: boolean; requestCount: number; failed?: boolean };

/**
 * The one place that calls `try_consume_anonymous_rate_limit` (migration
 * 0034) — a durable, atomic, Postgres-backed counter keyed by
 * `(scope, key_value, window_start)`, safe under concurrent requests
 * (the RPC takes a row lock) and, unlike an in-memory counter, safe
 * across serverless cold starts and multiple concurrent instances —
 * this table is what "durable production storage" means for every
 * anonymous-facing rate limit in this app. Originally private to
 * src/lib/quick-scan/rate-limit.ts; generalized here so every other
 * anonymous surface (auth forms, public lead forms, the sponsor
 * search, job-import cron routes) shares one real implementation
 * instead of each hand-rolling its own call to the same RPC.
 */
export async function consumeAnonymousRateLimit(
  scope: string,
  keyValue: string,
  windowStart: string,
  maxRequests: number,
): Promise<RateLimitOutcome> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("try_consume_anonymous_rate_limit", {
    p_scope: scope,
    p_key_value: keyValue,
    p_window_start: windowStart,
    p_max_requests: maxRequests,
  });

  if (error) {
    // Fail closed: if the rate-limit check itself can't run, don't let
    // an unmetered request through anyway.
    console.error(`consumeAnonymousRateLimit(${scope}) failed:`, error.message);
    return { allowed: false, requestCount: 0, failed: true };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; request_count: number } | undefined;
  return { allowed: row?.allowed ?? false, requestCount: row?.request_count ?? 0 };
}
