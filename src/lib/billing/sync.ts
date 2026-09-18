import "server-only";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePlanFromPriceId } from "@/lib/stripe/prices";
import { sendPaymentFailedEmail, sendSubscriptionCanceledEmail } from "@/lib/billing/notification-emails";

type BillingEventType =
  | "subscription_created"
  | "subscription_upgraded"
  | "subscription_downgraded"
  | "subscription_canceled"
  | "subscription_reactivated"
  | "payment_succeeded"
  | "payment_failed"
  | "trial_started"
  | "trial_ended"
  | "voice_topup_purchased";

// Stripe's status set is a superset of ours — collapse the two statuses
// we don't model (unpaid, paused) onto the closest real-world meaning
// rather than adding enum values nothing else reads yet.
function mapSubscriptionStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    case "incomplete":
      return "incomplete";
    default:
      return "incomplete";
  }
}

/**
 * Claims a Stripe event for processing by inserting its dedupe row
 * *before* applying any side effect, and un-claims it (deletes the row)
 * if `apply` throws — so a genuinely failed attempt can be retried by
 * Stripe's redelivery instead of being silently swallowed forever, while
 * a successful redelivery of an already-processed event is a no-op.
 */
async function withIdempotency(
  admin: SupabaseClient,
  event: Stripe.Event,
  userId: string,
  subscriptionRowId: string | null,
  eventType: BillingEventType,
  metadata: Record<string, unknown>,
  apply: () => Promise<void>,
): Promise<void> {
  const { error: insertError } = await admin.from("billing_events").insert({
    user_id: userId,
    subscription_id: subscriptionRowId,
    event_type: eventType,
    stripe_event_id: event.id,
    metadata,
  });

  if (insertError) {
    if (insertError.code === "23505") return; // duplicate delivery — already processed
    throw new Error(`Failed to record billing event ${event.id}: ${insertError.message}`);
  }

  try {
    await apply();
  } catch (err) {
    await admin.from("billing_events").delete().eq("stripe_event_id", event.id);
    throw err;
  }
}

async function findUserIdByStripeCustomerId(
  admin: SupabaseClient,
  stripeCustomerId: string,
): Promise<{ userId: string; subscriptionRowId: string; currentPlanId: string } | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("id, user_id, plan_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (!data) return null;
  return { userId: data.user_id, subscriptionRowId: data.id, currentPlanId: data.plan_id };
}

export async function handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Two completely different purchases share this one Stripe event type —
  // a recurring plan subscription (mode "subscription") and a one-time
  // voice top-up (mode "payment", src/lib/interviews/topup-actions.ts).
  // Route on mode + the metadata this app itself set when creating the
  // session (never anything Stripe echoes back from the client) before
  // either branch touches the database.
  if (session.mode === "payment" && session.metadata?.kind === "voice_topup") {
    await handleVoiceTopupCheckoutCompleted(event, session);
    return;
  }

  const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
  if (!userId) {
    console.warn(`checkout.session.completed ${event.id}: no user reference, skipping`);
    return;
  }

  const admin = createAdminClient();
  const { data: subscriptionRow } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  await withIdempotency(
    admin,
    event,
    userId,
    subscriptionRow?.id ?? null,
    "subscription_created",
    { stripe_customer_id: session.customer, stripe_checkout_session_id: session.id },
    async () => {
      // The subscription's own created/updated event carries the actual
      // plan/status/period data — this just makes sure the customer id
      // linked during checkout creation is confirmed, in case that
      // earlier write ever raced with anything.
      if (typeof session.customer === "string") {
        await admin
          .from("subscriptions")
          .update({ stripe_customer_id: session.customer })
          .eq("user_id", userId);
      }
    },
  );
}

/**
 * Credits a completed voice top-up purchase — the only writer of
 * migration 0045's voice_interview_topups, ever. `period_start` and
 * `credits` both come from this app's own Checkout Session metadata
 * (src/lib/interviews/topup-actions.ts sets them server-side at
 * creation), not anything Stripe lets the client influence, so they're
 * trusted here the same way a plan slug resolved via a price id is
 * trusted in handleSubscriptionCreatedOrUpdated below. Doubly
 * idempotent: withIdempotency's billing_events row guards the event as
 * a whole, and the table's own unique stripe_checkout_session_id column
 * is a second, storage-level guard against ever crediting the same
 * Checkout Session twice.
 */
async function handleVoiceTopupCheckoutCompleted(event: Stripe.Event, session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
  const periodStart = session.metadata?.period_start;
  const credits = Number(session.metadata?.credits);

  if (!userId || !periodStart || !Number.isFinite(credits) || credits <= 0) {
    console.warn(`checkout.session.completed ${event.id}: malformed voice top-up metadata, skipping`);
    return;
  }

  const admin = createAdminClient();
  const { data: subscriptionRow } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  await withIdempotency(
    admin,
    event,
    userId,
    subscriptionRow?.id ?? null,
    "voice_topup_purchased",
    { stripe_checkout_session_id: session.id, credits, period_start: periodStart },
    async () => {
      const { error } = await admin.from("voice_interview_topups").insert({
        user_id: userId,
        period_start: periodStart,
        credits,
        stripe_checkout_session_id: session.id,
      });

      if (error) {
        if (error.code === "23505") return; // duplicate Checkout Session id — already credited
        throw new Error(`Failed to record voice top-up: ${error.message}`);
      }
    },
  );
}

export async function handleSubscriptionCreatedOrUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const admin = createAdminClient();

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const existing =
    (await findUserIdByStripeCustomerId(admin, customerId)) ??
    (subscription.metadata?.supabase_user_id
      ? { userId: subscription.metadata.supabase_user_id, subscriptionRowId: null, currentPlanId: null }
      : null);

  if (!existing) {
    console.warn(`${event.type} ${event.id}: could not resolve a user for customer ${customerId}, skipping`);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const resolved = priceId ? resolvePlanFromPriceId(priceId) : null;
  if (!resolved) {
    console.warn(`${event.type} ${event.id}: price ${priceId} doesn't match any configured plan, skipping`);
    return;
  }

  const { data: plan } = await admin.from("plans").select("id, tier_order").eq("slug", resolved.plan).single();
  if (!plan) {
    console.warn(`${event.type} ${event.id}: resolved plan slug "${resolved.plan}" not found in plans table`);
    return;
  }

  let eventType: BillingEventType = "subscription_created";
  if (event.type === "customer.subscription.updated" && existing.currentPlanId) {
    const { data: previousPlan } = await admin
      .from("plans")
      .select("tier_order")
      .eq("id", existing.currentPlanId)
      .single();
    if (previousPlan && previousPlan.tier_order !== plan.tier_order) {
      eventType = previousPlan.tier_order < plan.tier_order ? "subscription_upgraded" : "subscription_downgraded";
    } else {
      eventType = "subscription_reactivated";
    }
  }

  const item = subscription.items.data[0];
  const periodStart = item?.current_period_start ?? subscription.start_date;
  const periodEnd = item?.current_period_end ?? null;

  await withIdempotency(
    admin,
    event,
    existing.userId,
    existing.subscriptionRowId,
    eventType,
    { stripe_subscription_id: subscription.id, plan_slug: resolved.plan, billing_cycle: resolved.cycle },
    async () => {
      const { error } = await admin
        .from("subscriptions")
        .update({
          plan_id: plan.id,
          status: mapSubscriptionStatus(subscription.status),
          billing_cycle: resolved.cycle,
          current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
        })
        .eq("user_id", existing.userId);

      if (error) throw new Error(`Failed to sync subscription: ${error.message}`);
    },
  );
}

export async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const admin = createAdminClient();

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const existing = await findUserIdByStripeCustomerId(admin, customerId);
  if (!existing) {
    console.warn(`customer.subscription.deleted ${event.id}: could not resolve a user for customer ${customerId}`);
    return;
  }

  await withIdempotency(
    admin,
    event,
    existing.userId,
    existing.subscriptionRowId,
    "subscription_canceled",
    { stripe_subscription_id: subscription.id },
    async () => {
      // Deliberately not reverting plan_id to free here — the row keeps
      // recording what they were subscribed to; `status` is what says
      // it's no longer active. Access-check code (when it exists) should
      // key off status, not assume plan_id alone means active access.
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("user_id", existing.userId);

      if (error) throw new Error(`Failed to mark subscription canceled: ${error.message}`);

      const { data: targetUser } = await admin.auth.admin.getUserById(existing.userId);
      if (targetUser.user?.email) await sendSubscriptionCanceledEmail(targetUser.user.email);
    },
  );
}

export async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const admin = createAdminClient();

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const existing = await findUserIdByStripeCustomerId(admin, customerId);
  if (!existing) {
    console.warn(`invoice.paid ${event.id}: could not resolve a user for customer ${customerId}`);
    return;
  }

  await withIdempotency(
    admin,
    event,
    existing.userId,
    existing.subscriptionRowId,
    "payment_succeeded",
    { stripe_invoice_id: invoice.id, amount_paid: invoice.amount_paid, currency: invoice.currency },
    async () => {
      // Self-heal out of past_due — a paid invoice means the payment
      // that was overdue has now succeeded.
      await admin
        .from("subscriptions")
        .update({ status: "active" })
        .eq("user_id", existing.userId)
        .eq("status", "past_due");
    },
  );
}

export async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const admin = createAdminClient();

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const existing = await findUserIdByStripeCustomerId(admin, customerId);
  if (!existing) {
    console.warn(`invoice.payment_failed ${event.id}: could not resolve a user for customer ${customerId}`);
    return;
  }

  await withIdempotency(
    admin,
    event,
    existing.userId,
    existing.subscriptionRowId,
    "payment_failed",
    {
      stripe_invoice_id: invoice.id,
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      attempt_count: invoice.attempt_count,
    },
    async () => {
      const { error } = await admin
        .from("subscriptions")
        .update({ status: "past_due" })
        .eq("user_id", existing.userId);

      if (error) throw new Error(`Failed to mark subscription past_due: ${error.message}`);

      const { data: targetUser } = await admin.auth.admin.getUserById(existing.userId);
      if (targetUser.user?.email) await sendPaymentFailedEmail(targetUser.user.email);
    },
  );
}
