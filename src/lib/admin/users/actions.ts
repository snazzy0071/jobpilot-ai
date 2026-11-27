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

const changePlanSchema = z.object({ userId: z.string().uuid(), planSlug: z.string().min(1).max(50) });

export type ChangeUserPlanResult = { error: string } | { success: string } | undefined;

/**
 * Puts an account on any plan without payment — for testers, the client,
 * staff and support goodwill. It writes the same thing a plan-granting
 * access code writes at signup (migration 0019): the user's single
 * `subscriptions` row gets the new plan_id and status 'active', plus a
 * `billing_events` row recording that an admin did it.
 *
 * Refused for an account billed through Stripe: there the webhook is the
 * only writer of subscription state, and a manual change would be
 * silently overwritten on the next Stripe event (and the person would
 * keep being charged for the old plan).
 */
export async function changeUserPlanByAdmin(_prevState: ChangeUserPlanResult, formData: FormData): Promise<ChangeUserPlanResult> {
  const { user: actingAdmin } = await requirePermission("manage_users");

  const parsed = changePlanSchema.safeParse({ userId: formData.get("userId"), planSlug: formData.get("planSlug") });
  if (!parsed.success) return { error: "Choose a plan first." };

  const admin = createAdminClient();
  const [{ data: plan }, { data: current }] = await Promise.all([
    admin.from("plans").select("id, slug, name, tier_order").eq("slug", parsed.data.planSlug).maybeSingle(),
    admin.from("subscriptions").select("id, stripe_subscription_id, status, plans(slug, tier_order)").eq("user_id", parsed.data.userId).maybeSingle(),
  ]);
  if (!plan) return { error: "That plan doesn't exist." };

  if (current?.stripe_subscription_id && current.status !== "canceled") {
    return { error: "This account pays through Stripe. Change or cancel the plan in Stripe instead, so billing stays correct." };
  }

  const previous = (Array.isArray(current?.plans) ? current?.plans[0] : current?.plans) as { slug: string; tier_order: number } | null | undefined;
  if (previous?.slug === plan.slug && current?.status === "active") {
    return { error: `This account is already on ${plan.name}.` };
  }

  const { data: saved, error } = await admin
    .from("subscriptions")
    .upsert(
      {
        user_id: parsed.data.userId,
        plan_id: plan.id,
        status: "active",
        billing_cycle: null,
        current_period_end: null,
        cancel_at_period_end: false,
        stripe_subscription_id: null,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();
  if (error || !saved) {
    console.error("changeUserPlanByAdmin failed:", error?.message);
    return { error: "Couldn't change the plan — try again." };
  }

  const upgraded = (previous?.tier_order ?? 0) <= plan.tier_order;
  await admin.from("billing_events").insert({
    user_id: parsed.data.userId,
    subscription_id: saved.id,
    event_type: upgraded ? "subscription_upgraded" : "subscription_downgraded",
    metadata: { source: "admin", from_plan: previous?.slug ?? "free", to_plan: plan.slug, admin_id: actingAdmin.id },
  });

  await logAdminAction({
    actorId: actingAdmin.id,
    actorEmail: actingAdmin.email ?? null,
    action: "subscription.change_plan",
    entityType: "subscription",
    entityId: parsed.data.userId,
    metadata: { fromPlan: previous?.slug ?? "free", toPlan: plan.slug },
  });

  revalidatePath(`/admin/users/${parsed.data.userId}`);
  revalidatePath("/admin/users");
  return { success: `Moved to ${plan.name}.` };
}
