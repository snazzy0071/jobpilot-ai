"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSessionSchema } from "@/lib/billing/schemas";
import type { PaidPlanSlug, BillingCycle } from "@/lib/billing/types";
import { hasLiveStripeSubscription, hasCancellableSubscription } from "@/lib/billing/subscription-state";
import { getStripeClient } from "@/lib/stripe/client";
import { getStripePriceId } from "@/lib/stripe/prices";
import { resolveStripeCustomerId } from "@/lib/stripe/customer";
import { siteConfig } from "@/config/site";

export type CheckoutResult = { error: string } | void;

const STRIPE_UNAVAILABLE = "Payments aren't set up yet — check back soon.";
const STRIPE_FAILED = "We couldn't reach our payment provider — nothing was changed. Try again in a moment.";

type SubscriptionRow = {
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_cycle: string | null;
  cancel_at_period_end: boolean;
  plans: { slug: string } | { slug: string }[] | null;
};

/** This user's own subscription row, read through their session (RLS: theirs only). The database, never a query string, decides what they have. */
async function loadSubscription(userId: string): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("status, stripe_customer_id, stripe_subscription_id, billing_cycle, cancel_at_period_end, plans(slug)")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}

const planSlugOf = (row: SubscriptionRow | null): string | null => {
  const plans = row?.plans;
  return (Array.isArray(plans) ? plans[0]?.slug : plans?.slug) ?? null;
};

// Bound with (planSlug, billingCycle) at the call site — see
// UpgradeButton — so it fits useActionState's (prevState, formData)
// signature while still taking the plan/cycle as real arguments.
//
// The security property this whole function exists to guarantee: the
// only plan-related input trusted from the client is *which* plan/cycle
// they're asking for, validated against an enum. What that actually
// costs is resolved in three independent, server-only steps — the
// `plans` table (does this plan exist and is it purchasable at all),
// the Stripe price id table (what does Stripe actually charge for it),
// and Stripe itself once the session is created (what the customer is
// actually shown) — none of which the client can influence. And it
// refuses to start a second subscription for someone who already has a
// live one (that would bill them twice): changing plan is a different action.
export async function createCheckoutSession(
  planSlug: PaidPlanSlug,
  billingCycle: BillingCycle,
  _prevState: CheckoutResult,
  _formData: FormData,
): Promise<CheckoutResult> {
  const user = await requireUser();

  const parsed = createCheckoutSessionSchema.safeParse({ planSlug, billingCycle });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, slug")
    .eq("slug", parsed.data.planSlug)
    .eq("is_active", true)
    .single();

  if (planError || !plan) {
    return { error: "That plan isn't available right now." };
  }

  const existing = await loadSubscription(user.id);
  if (hasLiveStripeSubscription(existing)) {
    return { error: "You already have a subscription. Use “Change plan” to switch, or “Manage billing” to update your payment details." };
  }

  let priceId: string;
  let stripe;
  try {
    priceId = getStripePriceId(parsed.data.planSlug, parsed.data.billingCycle);
    stripe = getStripeClient();
  } catch {
    return { error: STRIPE_UNAVAILABLE };
  }

  let url: string | null;
  try {
    const customerId = await resolveStripeCustomerId(stripe, user.id, user.email);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      // These URLs only decide which message the settings page shows. They never grant anything: the plan comes from the
      // subscriptions row that Stripe's webhook writes.
      success_url: `${siteConfig.domain}/dashboard/settings?tab=billing&checkout=success`,
      cancel_url: `${siteConfig.domain}/dashboard/settings?tab=billing&checkout=canceled`,
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan_slug: parsed.data.planSlug },
      },
      metadata: {
        supabase_user_id: user.id,
        plan_slug: parsed.data.planSlug,
        billing_cycle: parsed.data.billingCycle,
      },
    });
    url = session.url;
  } catch (err) {
    console.error("createCheckoutSession: Stripe call failed:", err);
    return { error: STRIPE_FAILED };
  }

  if (!url) {
    return { error: "Something went wrong starting checkout — try again in a moment." };
  }

  redirect(url);
}

export type BillingActionResult = { error: string } | void;

// None of the actions below write to `subscriptions` themselves — same
// as createCheckoutSession above, they only ever tell Stripe what
// changed and let the webhook handlers in src/lib/billing/sync.ts be the
// single writer of subscription state. Two write paths for the same
// table racing each other is exactly the kind of bug this avoids.

export async function createBillingPortalSession(
  _prevState: BillingActionResult,
  _formData: FormData,
): Promise<BillingActionResult> {
  const user = await requireUser();

  const subscription = await loadSubscription(user.id);
  if (!subscription?.stripe_customer_id) {
    return { error: "Subscribe to a paid plan first — there's no billing account to manage yet." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { error: STRIPE_UNAVAILABLE };
  }

  let url: string;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${siteConfig.domain}/dashboard/settings?tab=billing`,
    });
    url = session.url;
  } catch (err) {
    console.error("createBillingPortalSession: Stripe call failed:", err);
    return { error: STRIPE_FAILED };
  }

  redirect(url);
}

// Upgrade/downgrade (or a monthly <-> annual switch) for someone who
// already has a live Stripe subscription — changes the price on the
// existing subscription in place (with proration) instead of starting a
// new Checkout Session. If they don't have one (still on Free, or a
// previous subscription has ended), this is really a first subscription,
// so it defers to createCheckoutSession instead. Asking for exactly the
// plan and cycle they already have is refused.
export async function changeSubscriptionPlan(
  planSlug: PaidPlanSlug,
  billingCycle: BillingCycle,
  prevState: BillingActionResult,
  formData: FormData,
): Promise<BillingActionResult> {
  const user = await requireUser();

  const parsed = createCheckoutSessionSchema.safeParse({ planSlug, billingCycle });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, slug")
    .eq("slug", parsed.data.planSlug)
    .eq("is_active", true)
    .single();

  if (planError || !plan) {
    return { error: "That plan isn't available right now." };
  }

  const subscription = await loadSubscription(user.id);
  if (!hasLiveStripeSubscription(subscription) || !subscription?.stripe_subscription_id) {
    return createCheckoutSession(planSlug, billingCycle, prevState, formData);
  }

  if (planSlugOf(subscription) === parsed.data.planSlug && subscription.billing_cycle === parsed.data.billingCycle) {
    return { error: "You're already on that plan." };
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripeClient();
    priceId = getStripePriceId(parsed.data.planSlug, parsed.data.billingCycle);
  } catch {
    return { error: STRIPE_UNAVAILABLE };
  }

  try {
    const current = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    const currentItemId = current.items.data[0]?.id;
    if (!currentItemId) {
      return { error: "Couldn't find your current subscription details — try again in a moment." };
    }

    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{ id: currentItemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: { supabase_user_id: user.id, plan_slug: parsed.data.planSlug },
    });
  } catch (err) {
    console.error("changeSubscriptionPlan: Stripe call failed:", err);
    return { error: STRIPE_FAILED };
  }

  // The plan in force changes when Stripe's webhook lands and updates the row, not here.
  redirect("/dashboard/settings?tab=billing&plan=updated");
}

export async function cancelSubscription(
  _prevState: BillingActionResult,
  _formData: FormData,
): Promise<BillingActionResult> {
  const user = await requireUser();

  const subscription = await loadSubscription(user.id);
  if (!hasCancellableSubscription(subscription) || !subscription?.stripe_subscription_id) {
    return { error: "You don't have an active subscription to cancel." };
  }
  if (subscription.cancel_at_period_end) {
    return { error: "Your subscription is already set to end at the end of the current period." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { error: STRIPE_UNAVAILABLE };
  }

  try {
    await stripe.subscriptions.update(subscription.stripe_subscription_id, { cancel_at_period_end: true });
  } catch (err) {
    console.error("cancelSubscription: Stripe call failed:", err);
    return { error: STRIPE_FAILED };
  }

  redirect("/dashboard/settings?tab=billing&plan=canceling");
}

export async function reactivateSubscription(
  _prevState: BillingActionResult,
  _formData: FormData,
): Promise<BillingActionResult> {
  const user = await requireUser();

  const subscription = await loadSubscription(user.id);
  if (!hasCancellableSubscription(subscription) || !subscription?.stripe_subscription_id) {
    return { error: "You don't have a subscription to reactivate." };
  }
  if (!subscription.cancel_at_period_end) {
    return { error: "Your subscription isn't set to end, so there's nothing to reactivate." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { error: STRIPE_UNAVAILABLE };
  }

  try {
    await stripe.subscriptions.update(subscription.stripe_subscription_id, { cancel_at_period_end: false });
  } catch (err) {
    console.error("reactivateSubscription: Stripe call failed:", err);
    return { error: STRIPE_FAILED };
  }

  redirect("/dashboard/settings?tab=billing&plan=reactivated");
}
