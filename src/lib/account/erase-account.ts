import "server-only";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { sendAccountDeletedEmail } from "@/lib/settings/account-deleted-email";

export type EraseAccountResult = { error: string } | { erasedEmail: string | null };

/**
 * The single deletion/anonymization routine for permanently erasing an
 * account — used by both self-service `deleteAccount`
 * (src/lib/settings/actions.ts) and admin-triggered
 * `deleteUserAccountByAdmin` (src/lib/admin/users/actions.ts), so the
 * order of operations lives in exactly one place rather than two
 * independently-maintained copies that could quietly drift apart on
 * something this consequential.
 *
 * Order, and why:
 *
 * 1. Snapshot the email and any live Stripe subscription *before*
 *    anything destructive — `auth.admin.getUserById` and the
 *    `subscriptions` row won't be readable once the user is gone.
 *
 * 2. Billing: cancel any active Stripe subscription immediately (not
 *    `cancel_at_period_end` — there's no account left to keep billing
 *    toward) and *before* deleting the Supabase user. If Stripe is
 *    configured and the cancellation call fails for a reason other than
 *    the subscription already being gone on Stripe's own side, the
 *    whole erasure aborts rather than proceeding — deleting the account
 *    but leaving a live subscription still charging a Stripe customer
 *    nobody can reach any more is a real billing harm, worse than
 *    making the caller retry. `subscriptions` itself is never written
 *    to directly here (`cancel_at_period_end`/`status`); the existing
 *    webhook handler (`src/lib/billing/sync.ts`) is still the only
 *    writer of subscription state, so this cancellation converges on
 *    the same Stripe-is-truth flow every other cancellation in this app
 *    already uses — the row disappears a moment later via cascade
 *    (step 3) rather than needing its own update here.
 *
 * 3. Delete the Supabase Auth user. Every owned table cascades from
 *    `auth.users` at the database level — every `user_id uuid
 *    references auth.users` in this schema is either `on delete
 *    cascade` for genuinely user-owned data (CVs, cover letters,
 *    interviews, applications, the subscription row itself, etc.) or
 *    `on delete set null` for records that must survive as an
 *    anonymized historical trace after the actor behind them is gone
 *    (admin_audit_logs.actor_id, application data-export logs,
 *    institution invite `invited_by`/`accepted_by`, admin-role
 *    `granted_by`). No table in this schema references auth.users
 *    without one of those two — deleting the row can't silently orphan
 *    anything at the database level.
 *
 *    This app has never used Supabase Storage for any file:
 *    `src/app/api/files/parse`'s own doc comment confirms an uploaded
 *    CV/cover-letter file is parsed in memory and discarded, never
 *    written to a bucket, and institution logos are external URLs
 *    (`institutions.logo_url`, plain text) rather than uploads. There is
 *    currently no private-file cleanup step here because there is
 *    currently nothing in Storage to orphan. If a future feature starts
 *    writing to a bucket keyed by user id, its cleanup belongs here,
 *    before this step — Storage objects are not covered by a Postgres
 *    FK and would not be cleaned up by the cascade above.
 *
 * 4. Best-effort "your account has been deleted" confirmation email,
 *    sent to the address captured in step 1 (the auth record is already
 *    gone by now, so it can't be re-fetched afterward) — a failure here
 *    must never surface as an erasure failure, since the erasure itself
 *    already succeeded.
 */
export async function eraseUserAccount(userId: string): Promise<EraseAccountResult> {
  const admin = createAdminClient();

  const { data: targetUser } = await admin.auth.admin.getUserById(userId);
  const email = targetUser.user?.email ?? null;

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (subscription?.stripe_subscription_id && subscription.status !== "canceled") {
    let stripe: Stripe | null = null;
    try {
      stripe = getStripeClient();
    } catch {
      // Not configured in this environment — there's no real Stripe
      // subscription to worry about either.
    }

    if (stripe) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (err) {
        // Already gone on Stripe's own side (e.g. canceled from the
        // Stripe dashboard, or a prior attempt that got the
        // cancellation through but not the local status update) isn't
        // a reason to block deletion — anything else is.
        const alreadyGone = err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing";
        if (!alreadyGone) {
          console.error("eraseUserAccount: Stripe cancellation failed, aborting deletion:", err);
          return { error: "Couldn't cancel your active subscription — try again, or contact support." };
        }
      }
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "Couldn't delete that account — try again." };

  if (email) await sendAccountDeletedEmail(email);

  // Personal data that is keyed by the email ADDRESS rather than the account, so the cascade above does not reach it. Best-effort
  // and after the account is gone: a failure here is logged, never reported as a failed erasure.
  if (email) await eraseEmailKeyedRecords(admin, email);
  if (subscription?.stripe_customer_id) await deleteStripeCustomer(subscription.stripe_customer_id);

  return { erasedEmail: email };
}

/**
 * Removes what we hold against the email address itself: the newsletter subscription, contact-form messages, demo and partner
 * requests, and the log of emails we sent to it (recipient addresses), including the deletion confirmation just sent. Matching is
 * exact on the address (as stored and lower-cased), never a pattern, so another person's rows can't be caught by an address that
 * contains wildcard characters. Anonymous quick-scan results hold no address (only a hash used for the monthly cap), and the admin
 * audit log keeps the acting administrator's address by design (see docs/DATA_RETENTION.md).
 */
export async function eraseEmailKeyedRecords(admin: ReturnType<typeof createAdminClient>, email: string): Promise<void> {
  const variants = [...new Set([email, email.toLowerCase()])];
  const targets: [string, string][] = [
    ["newsletter_subscribers", "email"],
    ["contact_messages", "email"],
    ["demo_requests", "email"],
    ["partner_inquiries", "email"],
    ["campus_crew_applications", "email"],
    ["email_send_logs", "recipient"],
  ];
  for (const [table, column] of targets) {
    const { error } = await admin.from(table).delete().in(column, variants);
    if (error) console.error(`eraseEmailKeyedRecords: couldn't clear ${table}: ${error.message}`);
  }
}

/** Deletes the person's Stripe customer record (their email and name at Stripe). Stripe keeps invoices and payments it must retain for tax; this only removes the customer profile. */
async function deleteStripeCustomer(customerId: string): Promise<void> {
  try {
    await getStripeClient().customers.del(customerId);
  } catch (err) {
    // Not configured here, or already gone at Stripe: nothing more to do. Anything else is logged for follow-up.
    const alreadyGone = err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing";
    if (!alreadyGone && !(err instanceof Error && err.message.includes("isn't configured"))) console.error("eraseUserAccount: couldn't delete the Stripe customer:", err);
  }
}
