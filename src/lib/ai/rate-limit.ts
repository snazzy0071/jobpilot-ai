import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AI_RATE_LIMIT_WINDOW_SECONDS, AI_RATE_LIMIT_MAX_REQUESTS } from "@/lib/ai/config";
import { getFixedWindowStart } from "@/lib/rate-limit/windows";

export type RateLimitResult = { allowed: boolean; requestCount: number; limit: number };

/**
 * Atomically checks and consumes one request against a short, fixed
 * window — abuse/burst protection, independent of the plan-based
 * monthly usage entitlements in src/lib/entitlements/service.ts. Same
 * SELECT ... FOR UPDATE atomic pattern as try_consume_usage (migration
 * 0020), for the identical reason: a separate check-then-increment pair
 * would let concurrent requests both pass the check before either one
 * increments, defeating the limit.
 */
export async function consumeRateLimit(userId: string, operation: string): Promise<RateLimitResult> {
  const windowStart = getFixedWindowStart(AI_RATE_LIMIT_WINDOW_SECONDS);
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("try_consume_rate_limit", {
    p_user_id: userId,
    p_operation: operation,
    p_window_start: windowStart,
    p_max_requests: AI_RATE_LIMIT_MAX_REQUESTS,
  });

  if (error) {
    // Fail closed: if the rate-limit check itself can't run, don't let
    // a potentially expensive, abusable AI call through anyway.
    console.error("consumeRateLimit failed:", error.message);
    return { allowed: false, requestCount: 0, limit: AI_RATE_LIMIT_MAX_REQUESTS };
  }

  const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; request_count: number } | undefined;
  return {
    allowed: row?.allowed ?? false,
    requestCount: row?.request_count ?? 0,
    limit: AI_RATE_LIMIT_MAX_REQUESTS,
  };
}
