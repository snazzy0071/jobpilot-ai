import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminUserListItem, AdminUserDetail, AdminUserFilters, AdminUserRole } from "@/lib/admin/users/types";

// Same pagination cap scripts/promote-admin.mjs's own findUserByEmail
// already documents: 20,000 users is "well beyond anything this
// pre-launch app has". There's no server-side substring search over
// auth.users' email via the admin API, so listing/searching users
// means fetching the full roster and filtering in memory — the same
// tradeoff that script already made for a single email lookup, just
// reused here for a real list.
const LIST_USERS_PAGE_SIZE = 1000;
const MAX_LIST_USERS_PAGES = 20;

function firstOf<T>(value: T[] | T | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

async function listAllAuthUsers(admin: ReturnType<typeof createAdminClient>) {
  const users: { id: string; email: string | null; createdAt: string }[] = [];
  for (let page = 1; page <= MAX_LIST_USERS_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LIST_USERS_PAGE_SIZE });
    if (error || !data) break;
    users.push(...data.users.map((user) => ({ id: user.id, email: user.email ?? null, createdAt: user.created_at })));
    if (data.users.length < LIST_USERS_PAGE_SIZE) break;
  }
  return users;
}

/**
 * `profiles`/`subscriptions` are both self-select-only RLS, and email
 * lives only in `auth.users` — every read here needs the service-role
 * client. Search/role/plan filtering happens in memory after merging
 * the three sources, for the same reason listAllAuthUsers above does:
 * there's no single query that can filter by email substring, role,
 * and Stripe-synced plan status all at once across two different
 * tables plus `auth.users`.
 */
export async function listAdminUsers(filters: AdminUserFilters): Promise<AdminUserListItem[]> {
  const admin = createAdminClient();

  const [authUsers, { data: profiles }, { data: subscriptions }] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from("profiles").select("id, full_name, role, created_at"),
    admin.from("subscriptions").select("user_id, status, plans(slug)"),
  ]);

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const subscriptionByUser = new Map(
    (subscriptions ?? []).map((subscription) => {
      const plan = firstOf(subscription.plans as { slug: string }[] | { slug: string } | null);
      return [subscription.user_id, { status: subscription.status as string, planSlug: plan?.slug ?? "free" }];
    }),
  );

  let items: AdminUserListItem[] = authUsers.map((authUser) => {
    const profile = profileById.get(authUser.id);
    const subscription = subscriptionByUser.get(authUser.id);
    return {
      id: authUser.id,
      email: authUser.email,
      fullName: profile?.full_name ?? null,
      role: (profile?.role ?? "user") as AdminUserRole,
      planSlug: subscription?.planSlug ?? "free",
      subscriptionStatus: subscription?.status ?? null,
      createdAt: profile?.created_at ?? authUser.createdAt,
    };
  });

  if (filters.search) {
    const term = filters.search.trim().toLowerCase();
    items = items.filter((item) => (item.email ?? "").toLowerCase().includes(term) || (item.fullName ?? "").toLowerCase().includes(term));
  }
  if (filters.role) {
    items = items.filter((item) => item.role === filters.role);
  }
  if (filters.planStatus === "free") {
    items = items.filter((item) => item.subscriptionStatus === null);
  } else if (filters.planStatus) {
    items = items.filter((item) => item.subscriptionStatus === filters.planStatus);
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const admin = createAdminClient();

  const { data: authUserData, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError || !authUserData?.user) return null;

  const [{ data: profile }, { data: subscriptionRow }, { data: membershipRow }, { data: redemptions }] = await Promise.all([
    admin.from("profiles").select("full_name, role, created_at").eq("id", userId).maybeSingle(),
    admin
      .from("subscriptions")
      .select("status, billing_cycle, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, plans(name, slug)")
      .eq("user_id", userId)
      .maybeSingle(),
    admin.from("institution_members").select("institution_id, role, institutions(name)").eq("user_id", userId).maybeSingle(),
    admin.from("access_code_redemptions").select("redeemed_at, access_codes(code, label)").eq("user_id", userId),
  ]);

  const plan = firstOf(subscriptionRow?.plans as { name: string; slug: string }[] | { name: string; slug: string } | null);
  const institutionRelation = firstOf(membershipRow?.institutions as { name: string }[] | { name: string } | null);

  return {
    id: userId,
    email: authUserData.user.email ?? null,
    fullName: profile?.full_name ?? null,
    role: (profile?.role ?? "user") as AdminUserRole,
    planSlug: plan?.slug ?? "free",
    subscriptionStatus: subscriptionRow?.status ?? null,
    createdAt: profile?.created_at ?? authUserData.user.created_at,
    subscription: subscriptionRow
      ? {
          planName: plan?.name ?? "Free",
          status: subscriptionRow.status,
          billingCycle: subscriptionRow.billing_cycle,
          stripeCustomerId: subscriptionRow.stripe_customer_id,
          stripeSubscriptionId: subscriptionRow.stripe_subscription_id,
          currentPeriodEnd: subscriptionRow.current_period_end,
          cancelAtPeriodEnd: subscriptionRow.cancel_at_period_end,
        }
      : null,
    institution:
      membershipRow && institutionRelation
        ? { id: membershipRow.institution_id, name: institutionRelation.name, role: membershipRow.role }
        : null,
    accessCodeRedemptions: (redemptions ?? []).map((redemption) => {
      const code = firstOf(redemption.access_codes as { code: string; label: string }[] | { code: string; label: string } | null);
      return { code: code?.code ?? "—", label: code?.label ?? "—", redeemedAt: redemption.redeemed_at };
    }),
  };
}
