import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSubscription } from "@/lib/billing/queries";
import { statusGrantsPlan } from "@/lib/billing/subscription-state";
import { getInstitutionLicencePlan } from "@/lib/institutions/licence-access";
import { institutionPlanWins } from "@/lib/institutions/licence";
import type { FeatureKey, MeteredKey, UsageCheck } from "@/lib/entitlements/types";

/**
 * THE single server-side entitlement service. Every paid route, API
 * Route Handler, or Server Action that gates a feature or a numeric
 * limit must call `hasFeature`/`requireFeature` (booleans) or
 * `requireUsageAllowed`/`consumeUsage` (metered limits) from here before
 * doing the gated work — never infer entitlement from a client-supplied
 * plan name, a cached prop passed down through components, or a UI-only
 * check (a disabled button, a hidden link). The UI is free to *also*
 * reflect entitlements for a good experience —
 * src/components/settings/billing-panel.tsx already does, for display —
 * but it must never be the only gate.
 *
 * For metered limits specifically: `checkUsageAllowed` is a read-only
 * peek (display only); `consumeUsage`/`requireUsageAllowed` check and
 * increment atomically in one database transaction (migration 0020) and
 * are the only functions here safe to use for actual enforcement — see
 * their own comments for why a separate check-then-record pair, even
 * with an atomic increment on the "record" side, is still racy.
 *
 * Fails closed throughout: a missing subscription row, a query error
 * (e.g. these tables not existing yet in some environment), or a
 * subscription that isn't in good standing all resolve to Free's
 * entitlements, never a paid plan's. Getting this wrong in the
 * generous direction would mean a lapsed subscription keeps paid
 * access; getting it wrong in the strict direction just means someone
 * sees "upgrade" copy they didn't need to, which is a much smaller
 * problem, and it should never happen anyway once the data exists.
 */

// Statuses that still count as "has this plan's entitlements". Stripe
// keeps retrying a past_due invoice for a while before actually
// canceling — treating past_due as still-entitled matches that grace
// period instead of cutting access off at the first missed payment.
// Anything else (canceled, incomplete, incomplete_expired — mapped to
// canceled in src/lib/billing/sync.ts) falls back to Free.

export type PlanSource = "subscription" | "institution" | "free";

export type ResolvedEntitlements = {
  planSlug: string;
  /** Display name of the plan in force. */
  planName: string;
  /** Where the plan in force comes from: the person's own subscription (paid or granted), their institution's licence, or nothing (Free). */
  source: PlanSource;
  entitlements: Record<string, unknown>;
};

async function getFreeEntitlements(): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("entitlements").eq("slug", "free").maybeSingle();

  if (error) {
    console.error("getFreeEntitlements failed:", error.message);
  }
  // Empty object, not a thrown error, if even the fallback can't be
  // read — every hasFeature/getLimit check below already treats a
  // missing key as "not entitled" / "no limit configured", so this
  // degrades to "nothing is included" rather than crashing the caller.
  return data?.entitlements ?? {};
}

/**
 * Resolves what a user is actually entitled to right now. This is the
 * one place that decides "does this subscription's plan_id actually
 * apply" — see ENTITLED_STATUSES above — everything else in this file
 * is built on top of it.
 */
export async function getEntitlements(userId: string): Promise<ResolvedEntitlements> {
  const [subscription, licence] = await Promise.all([getCurrentSubscription(userId), getInstitutionLicencePlan(userId)]);

  const personal =
    subscription && statusGrantsPlan(subscription.status)
      ? { planSlug: subscription.planSlug, planName: subscription.planName, entitlements: subscription.entitlements }
      : { planSlug: "free", planName: "Free", entitlements: null as Record<string, unknown> | null };

  // A member of an institution with a licence in force gets that plan when it is better than their own (see licence-access.ts).
  if (licence && institutionPlanWins(personal.planSlug, licence.planSlug)) {
    return { planSlug: licence.planSlug, planName: licence.planName, source: "institution", entitlements: licence.entitlements };
  }

  return {
    planSlug: personal.planSlug,
    planName: personal.planName,
    source: personal.planSlug === "free" ? "free" : "subscription",
    entitlements: personal.entitlements ?? (await getFreeEntitlements()),
  };
}

export async function hasFeature(userId: string, key: FeatureKey): Promise<boolean> {
  const { entitlements } = await getEntitlements(userId);
  return entitlements[key] === true;
}

/**
 * Returns the configured limit, or null meaning unlimited — but only
 * when the entitlements blob *explicitly* says so. A genuinely missing
 * key (e.g. entitlements resolved to `{}` because the underlying tables
 * aren't reachable) must fail closed to 0, not be treated the same as
 * "unlimited" just because both are absent of a number — those are
 * opposite outcomes for what's supposed to be a fail-closed check.
 */
export async function getLimit(userId: string, key: MeteredKey): Promise<number | null> {
  const { entitlements } = await getEntitlements(userId);
  if (!(key in entitlements)) return 0;
  const value = entitlements[key];
  if (value === null) return null;
  const base = typeof value === "number" ? value : 0;

  // The one metric with a purchasable top-up today — everything else's
  // limit is exactly what the plan says, no extra query. Unlimited (the
  // `value === null` branch above) never reaches here, so a top-up is
  // meaningless there anyway.
  if (key !== "voice_interviews_per_month") return base;
  return base + (await getVoiceTopupCredits(userId));
}

// Metered limits reset on the calendar month, not each subscription's
// Stripe billing anniversary. Every numeric limit in the current
// entitlements shape (quick/tailored ATS scans, chat/voice interviews)
// is a usage allowance, not a proration concern — calendar-month
// boundaries are simpler and apply identically whether or not the user
// has ever had a real Stripe subscription (Free users have no billing
// period at all to align to).
//
// Exported so src/lib/interviews/topup-actions.ts and
// src/lib/billing/sync.ts's webhook handler stamp a voice top-up
// purchase with the exact same period_start this file sums it back
// against in getVoiceTopupCredits below — the two must never drift,
// or a top-up bought "this month" could silently apply to the wrong one.
export function getCurrentCalendarPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart: start.toISOString(), periodEnd: end.toISOString() };
}

/**
 * Extra voice interviews purchased for the current period (migration
 * 0045's voice_interview_topups — real Stripe purchases only, credited
 * by src/lib/billing/sync.ts's webhook handler, never client-writable).
 * Fails closed like everything else here: a query error means 0 extra
 * credits, not "trust the client" — under-granting capacity is always
 * the safe direction for a limit check.
 */
export async function getVoiceTopupCredits(userId: string): Promise<number> {
  const { periodStart } = getCurrentCalendarPeriod();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("voice_interview_topups")
    .select("credits")
    .eq("user_id", userId)
    .eq("period_start", periodStart);

  if (error) {
    console.error("getVoiceTopupCredits failed:", error.message);
    return 0;
  }
  return (data ?? []).reduce((sum, row) => sum + (row.credits as number), 0);
}

/**
 * Read-only peek at usage remaining — for *display* ("3 of 8 chat
 * interviews left this month"), not enforcement. Calling this and then
 * separately calling something to record usage is exactly the
 * check-then-act race migration 0020 exists to eliminate: two concurrent
 * calls can both peek while under the limit, both proceed, and both
 * push usage over it. For enforcement, use `consumeUsage` /
 * `requireUsageAllowed` below, which check and increment atomically in
 * one database transaction.
 */
export async function checkUsageAllowed(userId: string, metric: MeteredKey): Promise<UsageCheck> {
  const limit = await getLimit(userId, metric);
  if (limit === null) {
    return { allowed: true, limit: null, used: 0, remaining: null };
  }

  const { periodStart } = getCurrentCalendarPeriod();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_usage")
    .select("used_count")
    .eq("user_id", userId)
    .eq("metric", metric)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (error) {
    console.error("checkUsageAllowed failed:", error.message);
    // Fail closed on a metered check too: if we can't confirm how much
    // is left, don't allow more use.
    return { allowed: false, limit, used: limit, remaining: 0 };
  }

  const used = data?.used_count ?? 0;
  return { allowed: used < limit, limit, used, remaining: Math.max(0, limit - used) };
}

/**
 * Atomically checks the limit and consumes one use in a single database
 * transaction (migration 0020's `try_consume_usage`, which takes a row
 * lock so a concurrent call for the same user/metric/period blocks
 * until this one commits) — this is the one safe way to enforce a
 * metered limit. Call it *before* doing the gated work; if `allowed` is
 * false, don't do the work. If the work fails afterward, call
 * `releaseUsage` to refund the reservation rather than permanently
 * charging for a failure.
 */
export async function consumeUsage(userId: string, metric: MeteredKey, amount = 1): Promise<UsageCheck> {
  const limit = await getLimit(userId, metric);
  const { periodStart, periodEnd } = getCurrentCalendarPeriod();
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("try_consume_usage", {
    p_user_id: userId,
    p_metric: metric,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_limit: limit,
    p_amount: amount,
  });

  if (error) {
    throw new Error(`Failed to consume usage for ${metric}: ${error.message}`);
  }

  // RETURNS TABLE comes back as an array of rows over the JS client.
  const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; used_count: number } | undefined;
  const used = row?.used_count ?? limit ?? 0;
  const allowed = row?.allowed ?? false;

  return { allowed, limit, used, remaining: limit === null ? null : Math.max(0, limit - used) };
}

/**
 * Refunds `amount` usage previously taken by `consumeUsage`, for when
 * the gated work it guarded failed after usage was already reserved.
 * Never throws — a failed release just means a slightly stale count
 * until the period resets, which is far preferable to letting a refund
 * failure mask the original error the caller is already handling.
 */
export async function releaseUsage(userId: string, metric: MeteredKey, amount = 1): Promise<void> {
  const { periodStart } = getCurrentCalendarPeriod();
  const admin = createAdminClient();

  const { error } = await admin.rpc("release_usage", {
    p_user_id: userId,
    p_metric: metric,
    p_period_start: periodStart,
    p_amount: amount,
  });

  if (error) {
    console.error(`Failed to release usage for ${metric}:`, error.message);
  }
}

export class EntitlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntitlementError";
  }
}

/**
 * Throws EntitlementError if the feature isn't included in the user's
 * current plan. Call at the very top of a gated Server Action or Route
 * Handler, before any other work — this is the "must use it" part of
 * the contract, not something to call only when convenient.
 */
export async function requireFeature(userId: string, key: FeatureKey): Promise<void> {
  if (!(await hasFeature(userId, key))) {
    throw new EntitlementError("This feature isn't included in your current plan.");
  }
}

/**
 * Atomically consumes one use and throws EntitlementError if that
 * exceeds the limit — the actual guard call a route/action makes at the
 * top of its handler, immediately before doing the gated work. Unlike
 * the old check-then-record pattern, usage is already reserved by the
 * time this returns successfully: if the gated work fails afterward,
 * call `releaseUsage(userId, metric)` to refund it.
 */
export async function requireUsageAllowed(userId: string, metric: MeteredKey, amount = 1): Promise<UsageCheck> {
  const result = await consumeUsage(userId, metric, amount);
  if (!result.allowed) {
    throw new EntitlementError(
      result.limit === 0
        ? "This isn't included in your current plan."
        : `You've used all ${result.limit} of your allowance for this feature this month.`,
    );
  }
  return result;
}
