"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSessionSchema } from "@/lib/billing/schemas";
import type { PaidPlanSlug, BillingCycle } from "@/lib/billing/types";
import { getStripeClient } from "@/lib/stripe/client";
import { getStripePriceId } from "@/lib/stripe/prices";
import { resolveStripeCustomerId } from "@/lib/stripe/customer";
import { siteConfig } from "@/config/site";

export type CheckoutResult = { error: string } | void;

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
// actually shown) — none of which the client can influence.
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

  let priceId: string;
  let stripe;
  try {
    priceId = getStripePriceId(parsed.data.planSlug, parsed.data.billingCycle);
    stripe = getStripeClient();
  } catch {
    return { error: "Payments aren't set up yet — check back soon." };
  }

  const customerId = await resolveStripeCustomerId(stripe, user.id, user.email);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${siteConfig.domain}/dashboard/settings?checkout=success`,
    cancel_url: `${siteConfig.domain}/dashboard/settings?checkout=canceled`,
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan_slug: parsed.data.planSlug },
    },
    metadata: {
      supabase_user_id: user.id,
      plan_slug: parsed.data.planSlug,
      billing_cycle: parsed.data.billingCycle,
    },
  });

  if (!session.url) {
    return { error: "Something went wrong starting checkout — try again in a moment." };
  }

  redirect(session.url);
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

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return { error: "Subscribe to a paid plan first — there's no billing account to manage yet." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { error: "Payments aren't set up yet — check back soon." };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${siteConfig.domain}/dashboard/settings?tab=billing`,
  });

  redirect(session.url);
}

// Upgrade/downgrade for someone who already has a live Stripe
// subscription — changes the price on the existing subscription in
// place (with proration) instead of starting a new Checkout Session. If
// they don't have one yet (still on Free), this is really a first
// subscription, so it defers to createCheckoutSession instead.
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

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    return createCheckoutSession(planSlug, billingCycle, prevState, formData);
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripeClient();
    priceId = getStripePriceId(parsed.data.planSlug, parsed.data.billingCycle);
  } catch {
    return { error: "Payments aren't set up yet — check back soon." };
  }

  const currentStripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  const currentItemId = currentStripeSubscription.items.data[0]?.id;
  if (!currentItemId) {
    return { error: "Couldn't find your current subscription details — try again in a moment." };
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    items: [{ id: currentItemId, price: priceId }],
    proration_behavior: "create_prorations",
    metadata: { supabase_user_id: user.id, plan_slug: parsed.data.planSlug },
  });

  redirect("/dashboard/settings?tab=billing&plan=updated");
}

export async function cancelSubscription(
  _prevState: BillingActionResult,
  _formData: FormData,
): Promise<BillingActionResult> {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    return { error: "You don't have an active subscription to cancel." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { error: "Payments aren't set up yet — check back soon." };
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: true,
  });

  redirect("/dashboard/settings?tab=billing&plan=canceling");
}

export async function reactivateSubscription(
  _prevState: BillingActionResult,
  _formData: FormData,
): Promise<BillingActionResult> {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    return { error: "You don't have a subscription to reactivate." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { error: "Payments aren't set up yet — check back soon." };
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  redirect("/dashboard/settings?tab=billing&plan=reactivated");
}
