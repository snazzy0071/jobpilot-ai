import "server-only";
import { getStripeEnv } from "@/lib/stripe/env";
import { PAID_PLAN_SLUGS, BILLING_CYCLES, type PaidPlanSlug, type BillingCycle } from "@/lib/billing/types";

/**
 * The only trusted mapping from (plan, cycle) to a Stripe Price id. A
 * client can ask for "pro" + "monthly" — it can never supply a price id
 * or an amount directly. Every price actually charged comes from this
 * table, resolved server-side, or from Stripe's own webhook payload
 * (never from anything the client sent).
 */
function getPriceTable(): Record<PaidPlanSlug, Record<BillingCycle, string>> {
  const env = getStripeEnv();
  return {
    pro: { monthly: env.STRIPE_PRICE_PRO_MONTHLY, annual: env.STRIPE_PRICE_PRO_ANNUAL },
    premium: { monthly: env.STRIPE_PRICE_PREMIUM_MONTHLY, annual: env.STRIPE_PRICE_PREMIUM_ANNUAL },
    elite: { monthly: env.STRIPE_PRICE_ELITE_MONTHLY, annual: env.STRIPE_PRICE_ELITE_ANNUAL },
  };
}

export function getStripePriceId(plan: PaidPlanSlug, cycle: BillingCycle): string {
  return getPriceTable()[plan][cycle];
}

/**
 * The reverse direction, used by the webhook handler: given a price id
 * Stripe itself reports on a subscription (authoritative — Stripe
 * charged this, nobody supplied it), figure out which plan and cycle it
 * corresponds to. Returns null for an unrecognised price id rather than
 * guessing, so the webhook handler can skip/flag it instead of silently
 * mis-assigning a plan.
 */
/** The one-time Price for a voice top-up purchase (src/lib/interviews/topup-actions.ts) — not part of the (plan, cycle) table above, since it isn't a subscription price at all. */
export function getVoiceTopupPriceId(): string {
  return getStripeEnv().STRIPE_PRICE_VOICE_TOPUP;
}

export function resolvePlanFromPriceId(
  priceId: string,
): { plan: PaidPlanSlug; cycle: BillingCycle } | null {
  const table = getPriceTable();
  for (const plan of PAID_PLAN_SLUGS) {
    for (const cycle of BILLING_CYCLES) {
      if (table[plan][cycle] === priceId) return { plan, cycle };
    }
  }
  return null;
}
