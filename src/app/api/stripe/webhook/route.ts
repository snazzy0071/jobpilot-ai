import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { getStripeEnv } from "@/lib/stripe/env";
import {
  handleCheckoutSessionCompleted,
  handleSubscriptionCreatedOrUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
} from "@/lib/billing/sync";

// Stripe requires the raw, unparsed request body to verify the
// `stripe-signature` header — Next's default body parsing would break
// that, so this reads the body as text itself rather than via req.json().
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text();

  let stripe: Stripe;
  let webhookSecret: string;
  try {
    stripe = getStripeClient();
    webhookSecret = getStripeEnv().STRIPE_WEBHOOK_SECRET;
  } catch (err) {
    console.error("Stripe webhook received but Stripe isn't configured:", err);
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionCreatedOrUpdated(event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event);
        break;
      default:
        // Any other event type: acknowledge so Stripe doesn't retry an
        // event we deliberately don't act on.
        break;
    }
  } catch (err) {
    console.error(`Failed to process Stripe event ${event.id} (${event.type}):`, err);
    // 500 tells Stripe to retry. Safe to retry: each handler claims its
    // event via a unique stripe_event_id before applying side effects,
    // and un-claims it if the side effect itself throws (see
    // withIdempotency in src/lib/billing/sync.ts) — so a retry either
    // finds nothing to do or finishes what didn't complete last time,
    // never double-applies.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
