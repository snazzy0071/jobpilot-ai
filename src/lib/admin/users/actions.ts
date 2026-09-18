"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { getStripeClient } from "@/lib/stripe/client";
import { eraseUserAccount } from "@/lib/account/erase-account";

const userIdSchema = z.object({ userId: z.string().uuid() });

/**
 * The one and only write this makes is to Stripe — exactly the same
 * `cancel_at_period_end: true` call the user's own
 * cancelSubscription() (src/lib/billing/actions.ts) makes for
 * themselves, just admin-triggered. It never touches the
 * `subscriptions` row directly; the existing webhook handler
 * (src/lib/billing/sync.ts) is still the only writer of subscription
 * state, so this and every user-initiated cancellation converge on the
 * exact same source of truth instead of racing it. This is the actual
 * meaning of "never bypass Stripe truth for billing status" for this
 * action.
 */
export async function cancelUserSubscriptionByAdmin(_prevState: unknown, formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_users");

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, cancel_at_period_end")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id) {
    return { error: "This account has no Stripe-billed subscription to cancel." };
  }
  if (subscription.cancel_at_period_end) {
    return { error: "This subscription is already set to cancel at period end." };
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch {
    return { error: "Stripe isn't configured in this environment." };
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id, { cancel_at_period_end: true });

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "subscription.cancel",
    entityType: "subscription",
    entityId: parsed.data.userId,
    metadata: { stripeSubscriptionId: subscription.stripe_subscription_id },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
}

/**
 * Deletes an account outright via the same order-sensitive erasure
 * routine self-service deleteAccount uses
 * (src/lib/account/erase-account.ts's eraseUserAccount — Stripe
 * subscription canceled before the Supabase user is deleted, everything
 * else user-owned cascades from `auth.users`). Two guards keep this from
 * being a way to casually deprovision staff or lock out the acting
 * admin: never the caller's own account (use normal account settings
 * for that), and never an account already flagged `profiles.role =
 * 'admin'` — deprovisioning another admin stays a script/SQL-direct
 * action (docs/ADMIN_PROMOTION.md), the same deliberately-out-of-band
 * boundary promotion *to* admin already has.
 */
export async function deleteUserAccountByAdmin(_prevState: unknown, formData: FormData) {
  const { user: actingAdmin } = await requirePermission("manage_users");

  const parsed = userIdSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return { error: "Invalid request." };

  if (parsed.data.userId === actingAdmin.id) {
    return { error: "Use your own account settings to delete your account." };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", parsed.data.userId).maybeSingle();
  if (profile?.role === "admin") {
    return { error: "Admin accounts can't be deleted from this page — see docs/ADMIN_PROMOTION.md." };
  }

  const result = await eraseUserAccount(parsed.data.userId);
  if ("error" in result) return { error: result.error };

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "user.delete",
    entityType: "user",
    entityId: parsed.data.userId,
    metadata: { deletedEmail: result.erasedEmail },
  });

  revalidatePath("/admin/users");
}
