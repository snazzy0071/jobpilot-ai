import "server-only";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves this user's Stripe customer id, creating one in Stripe (and
 * persisting it to `subscriptions`, which has no client-writable
 * insert/update policy — this is the trusted server-side logic that
 * policy defers to) the first time they ever reach a paid flow. Shared
 * by every Checkout-creating action — src/lib/billing/actions.ts's plan
 * subscription checkout and src/lib/interviews/topup-actions.ts's voice
 * top-up checkout — so there's exactly one place a Stripe customer ever
 * gets created for a given user, not two independent copies that could
 * race and create two.
 */
export async function resolveStripeCustomerId(stripe: Stripe, userId: string, email: string | undefined): Promise<string> {
  const supabase = await createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (subscription?.stripe_customer_id) return subscription.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId },
  });

  const admin = createAdminClient();
  await admin.from("subscriptions").update({ stripe_customer_id: customer.id }).eq("user_id", userId);

  return customer.id;
}
