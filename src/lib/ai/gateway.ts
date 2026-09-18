import "server-only";
import { requireFeature, requireUsageAllowed, releaseUsage } from "@/lib/entitlements/service";
import type { FeatureKey, MeteredKey } from "@/lib/entitlements/types";
import { consumeRateLimit } from "@/lib/ai/rate-limit";
import { generateText, generateStructured, type GenerateTextOptions, type GenerateStructuredOptions } from "@/lib/ai/service";
import { AIServiceError } from "@/lib/ai/errors";

/**
 * THE mandatory entry point for AI calls — CLAUDE.md requires every
 * AI-powered feature to call `generateTextGated`/`generateStructuredGated`
 * from here, never `generateText`/`generateStructured` in
 * src/lib/ai/service.ts directly. Calling the service directly skips
 * every one of the checks below; nothing else enforces this.
 *
 * For an authenticated guard, order matters and is deliberate:
 *   1. auth      — a real, already-authenticated user id is required
 *                  (this module can't establish a session itself — the
 *                  caller must have already called requireUser() — but
 *                  it refuses to proceed with no id at all).
 *   2. rate limit — checked *before* entitlements, so a request that
 *                  would fail anyway (wrong plan) still counts against
 *                  the abuse limit. Otherwise the rate limit itself
 *                  becomes a free probing tool.
 *   3. entitlement — hasFeature/requireFeature: does this plan include
 *                  this at all.
 *   4. usage      — requireUsageAllowed: metered limit, atomically
 *                  consumed as part of the check (see migration 0020) —
 *                  only reached if the request survives 1–3.
 *
 * If the AI call itself then fails, any usage already consumed in step 4
 * is refunded via releaseUsage — a failure shouldn't permanently cost the
 * user part of their monthly allowance.
 *
 * `{ anonymous: true }` is the one deliberate exception to all of the
 * above — for a feature with no account to check a plan/entitlement
 * against at all (Quick Scan: no login, no card). It skips every guard
 * here outright, which is only safe because the CALLER must already have
 * performed an equivalent check itself before ever reaching this
 * function — Quick Scan's own per-normalized-email and per-IP monthly
 * caps (src/lib/quick-scan/rate-limit.ts), not this module's
 * per-user `ai_rate_limit_windows`, which has no concept of "no user" to
 * key off. The call still goes through this same gateway (still the one
 * place that constructs the Anthropic client and logs usage) and still
 * writes a real `ai_usage_logs` row, just with `userId: null` — cost
 * visibility doesn't require a user to attribute it to.
 */

export type AIOperationGuard =
  | {
      userId: string;
      /** Boolean plan feature this operation requires, if any (e.g. "cover_letter_generator"). */
      featureKey?: FeatureKey;
      /** Metered plan limit this operation consumes, if any (e.g. "ai_operations_per_month"). */
      meteredKey?: MeteredKey;
    }
  | { anonymous: true };

async function runGuards(guard: AIOperationGuard, operation: string): Promise<{ usageConsumed: boolean }> {
  if ("anonymous" in guard) {
    return { usageConsumed: false };
  }

  const rateLimit = await consumeRateLimit(guard.userId, operation);
  if (!rateLimit.allowed) {
    throw new AIServiceError("You're sending requests too quickly — wait a moment and try again.", "rate_limited");
  }

  if (guard.featureKey) {
    // Throws EntitlementError (src/lib/entitlements/service.ts) with its
    // own safe message if this plan doesn't include the feature at all —
    // deliberately not wrapped into AIServiceError, both already carry
    // safe, displayable messages and callers can treat them the same way.
    await requireFeature(guard.userId, guard.featureKey);
  }

  if (guard.meteredKey) {
    await requireUsageAllowed(guard.userId, guard.meteredKey);
    return { usageConsumed: true };
  }

  return { usageConsumed: false };
}

async function releaseIfConsumed(guard: AIOperationGuard, usageConsumed: boolean): Promise<void> {
  if (!usageConsumed || "anonymous" in guard || !guard.meteredKey) return;
  await releaseUsage(guard.userId, guard.meteredKey);
}

export async function generateTextGated(
  guard: AIOperationGuard,
  options: Omit<GenerateTextOptions, "userId">,
): Promise<string> {
  const { usageConsumed } = await runGuards(guard, options.operation);
  const userId = "anonymous" in guard ? null : guard.userId;

  try {
    return await generateText({ ...options, userId });
  } catch (err) {
    await releaseIfConsumed(guard, usageConsumed);
    throw err;
  }
}

export async function generateStructuredGated<T>(
  guard: AIOperationGuard,
  options: Omit<GenerateStructuredOptions<T>, "userId">,
): Promise<T> {
  const { usageConsumed } = await runGuards(guard, options.operation);
  const userId = "anonymous" in guard ? null : guard.userId;

  try {
    return await generateStructured({ ...options, userId });
  } catch (err) {
    await releaseIfConsumed(guard, usageConsumed);
    throw err;
  }
}
