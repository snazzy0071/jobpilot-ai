"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission, hasPermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { getStripeClient } from "@/lib/stripe/client";
import { eraseUserAccount } from "@/lib/account/erase-account";

const userIdSchema = z.object({ userId: z.string().uuid() });
const bulkUserIdsSchema = z.object({ userIds: z.array(z.string().uuid()).min(1).max(200) });

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
 * else user-owned cascades from `auth.users`). Two guards, one absolute
 * and one permission-gated: never the caller's own account, ever (use
 * normal account settings for that — a hard rule regardless of
 * privilege, so no admin can ever fat-finger locking everyone out or
 * removing the only account able to grant roles); deleting another
 * `profiles.role = 'admin'` account requires the acting admin to also
 * hold `manage_admin_roles` (the same permission that gates
 * /admin/roles — a plain `manage_users` admin, e.g. support-only staff,
 * still can't deprovision other admins from this page, but a real
 * super admin can, rather than that always staying a script/SQL-direct
 * action per docs/ADMIN_PROMOTION.md).
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
  if (profile?.role === "admin" && !(await hasPermission(actingAdmin.id, "manage_admin_roles"))) {
    return { error: "Deleting an admin account needs the \"Manage admin roles\" permission." };
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

export type BulkDeleteUsersResult =
  | { error: string }
  | { deletedCount: number; skipped: { userId: string; reason: string }[] };

/**
 * The multi-select "Delete selected" action on the users list. Reuses the
 * exact same guards and erasure routine as the single-account
 * `deleteUserAccountByAdmin` above (self always skipped; another admin
 * only deletable with `manage_admin_roles`), just applied per-id in a
 * loop instead of rejecting the whole request — a bad id in a
 * 50-account selection shouldn't block deleting the other 49. `skipped`
 * reports which ids were skipped and why, so the caller can show an
 * honest summary rather than a silent partial success.
 */
export async function deleteUsersAccountsByAdmin(_prevState: unknown, formData: FormData): Promise<BulkDeleteUsersResult> {
  const { user: actingAdmin } = await requirePermission("manage_users");
  const canDeleteAdmins = await hasPermission(actingAdmin.id, "manage_admin_roles");

  const parsed = bulkUserIdsSchema.safeParse({ userIds: formData.getAll("userIds") });
  if (!parsed.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const skipped: { userId: string; reason: string }[] = [];
  let deletedCount = 0;

  for (const userId of new Set(parsed.data.userIds)) {
    if (userId === actingAdmin.id) {
      skipped.push({ userId, reason: "your own account" });
      continue;
    }

    const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profile?.role === "admin" && !canDeleteAdmins) {
      skipped.push({ userId, reason: "deleting an admin needs the \"Manage admin roles\" permission" });
      continue;
    }

    const result = await eraseUserAccount(userId);
    if ("error" in result) {
      skipped.push({ userId, reason: result.error });
      continue;
    }

    await logAdminAction({
      actorId: actingAdmin.id,
      actorEmail: actingAdmin.email ?? null,
      action: "user.delete",
      entityType: "user",
      entityId: userId,
      metadata: { deletedEmail: result.erasedEmail, bulk: true },
    });
    deletedCount++;
  }

  revalidatePath("/admin/users");
  return { deletedCount, skipped };
}
