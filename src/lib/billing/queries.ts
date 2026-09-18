import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CurrentSubscription = {
  planSlug: string;
  planName: string;
  status: string;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  entitlements: Record<string, unknown>;
};

type SubscriptionRow = {
  status: string;
  billing_cycle: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  plan: { slug: string; name: string; entitlements: Record<string, unknown> } | null;
};

// The one place the app reads "what plan is this user actually on, and
// what does it include" — from the real subscriptions/plans tables kept
// current by Stripe webhooks, not the parallel src/config/plans.ts TS
// config (which only ever described the marketing pages) and not the
// simple profiles.plan free/paid flag (which only tracks paid-vs-not).
//
// Returns null on any failure, including "the billing migrations aren't
// applied to this database yet" — callers must have an honest fallback
// for that, not assume this always resolves.
export async function getCurrentSubscription(userId: string): Promise<CurrentSubscription | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "status, billing_cycle, current_period_end, cancel_at_period_end, stripe_customer_id, plan:plans ( slug, name, entitlements )",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("getCurrentSubscription failed:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as SubscriptionRow;
  if (!row.plan) return null;

  return {
    planSlug: row.plan.slug,
    planName: row.plan.name,
    status: row.status,
    billingCycle: row.billing_cycle,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    hasStripeCustomer: Boolean(row.stripe_customer_id),
    entitlements: row.plan.entitlements,
  };
}
