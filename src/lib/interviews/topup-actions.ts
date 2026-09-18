"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireFeature, getCurrentCalendarPeriod, EntitlementError } from "@/lib/entitlements/service";
import { getStripeClient } from "@/lib/stripe/client";
import { getVoiceTopupPriceId } from "@/lib/stripe/prices";
import { resolveStripeCustomerId } from "@/lib/stripe/customer";
import { siteConfig } from "@/config/site";
import { VOICE_TOPUP_CREDITS } from "@/lib/interviews/topup-config";

export type VoiceTopupResult = { error: string } | void;

/**
 * Starts a one-time-payment Checkout Session for a voice interview
 * top-up — Elite-only today (`voice_topups_allowed`, migration 0016),
 * enforced server-side here regardless of what the calling page's UI
 * already hid. Bound with `returnPath` at the call site (same
 * (args...) -> (prevState, formData) shape as
 * src/lib/billing/actions.ts's changeSubscriptionPlan) so both the
 * interview setup form and a mid-session "you're out of voice
 * interviews" prompt can send the buyer back to wherever they started
 * from, with a `?topup=success`/`?topup=canceled` banner.
 *
 * The purchased credit isn't written here — Stripe hasn't actually been
 * paid yet at this point, only asked. src/lib/billing/sync.ts's webhook
 * handler is the one place migration 0045's voice_interview_topups ever
 * gets a row, exactly once per Checkout Session id, once Stripe confirms
 * the payment actually succeeded.
 */
export async function purchaseVoiceTopup(
  returnPath: string,
  _prevState: VoiceTopupResult,
  _formData: FormData,
): Promise<VoiceTopupResult> {
  const user = await requireUser();

  try {
    await requireFeature(user.id, "voice_topups_allowed");
  } catch (err) {
    return { error: err instanceof EntitlementError ? err.message : "Voice top-ups aren't available on your plan." };
  }

  let stripe;
  let priceId: string;
  try {
    stripe = getStripeClient();
    priceId = getVoiceTopupPriceId();
  } catch {
    return { error: "Voice top-ups aren't set up yet — check back soon." };
  }

  const customerId = await resolveStripeCustomerId(stripe, user.id, user.email);
  const { periodStart } = getCurrentCalendarPeriod();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${siteConfig.domain}${returnPath}?topup=success`,
    cancel_url: `${siteConfig.domain}${returnPath}?topup=canceled`,
    metadata: {
      supabase_user_id: user.id,
      kind: "voice_topup",
      period_start: periodStart,
      credits: String(VOICE_TOPUP_CREDITS),
    },
  });

  if (!session.url) {
    return { error: "Something went wrong starting checkout — try again in a moment." };
  }

  redirect(session.url);
}
