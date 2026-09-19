import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_MESSAGE_LENGTH = 500;

/**
 * Best-effort bookkeeping for the admin overview's "failed webhooks"
 * number (table: migration 0090). Both helpers swallow their own errors
 * on purpose: this is observability, and it must never change what the
 * webhook route tells Stripe — a failure to *record* a failure can't be
 * allowed to turn a 500 into a different failure, or a 200 into a 500.
 * Only the processing error's own message is stored, truncated; never the
 * request body.
 */
export async function recordStripeWebhookFailure(eventId: string, eventType: string, error: unknown): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    await createAdminClient()
      .from("stripe_webhook_failures")
      .insert({ stripe_event_id: eventId, event_type: eventType, error_message: message.slice(0, MAX_MESSAGE_LENGTH) });
  } catch (recordError) {
    console.error("Could not record Stripe webhook failure:", recordError);
  }
}

/** A retry that finally succeeded: stamp every earlier failed attempt for this event as resolved. */
export async function markStripeWebhookResolved(eventId: string): Promise<void> {
  try {
    await createAdminClient()
      .from("stripe_webhook_failures")
      .update({ resolved_at: new Date().toISOString() })
      .eq("stripe_event_id", eventId)
      .is("resolved_at", null);
  } catch (recordError) {
    console.error("Could not mark Stripe webhook failure resolved:", recordError);
  }
}
