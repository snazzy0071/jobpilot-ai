import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { summariseBilling } from "@/lib/admin/overview/queries";
import type { BillingOverview } from "@/lib/admin/overview/types";
import { z } from "zod";

const num = z.coerce.number().catch(0);
const breakdownSchema = z.array(
  z.object({
    plan_slug: z.string(),
    plan_name: z.string(),
    tier_order: num,
    monthly_price_pence: num,
    annual_price_pence: num,
    status: z.string(),
    billing_cycle: z.string().nullable(),
    stripe_billed: z.boolean().catch(false),
    count: num,
  }),
);

export type AdminPlan = {
  id: string;
  slug: string;
  name: string;
  tierOrder: number;
  monthlyPricePence: number;
  annualPricePence: number;
  isActive: boolean;
  entitlements: Record<string, unknown>;
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  mrrPence: number;
  /** Institution licences in force on this plan, and the seats they cover. */
  licences: number;
  licensedSeats: number;
};

export type AdminSubscriptionRow = {
  userId: string;
  fullName: string | null;
  planName: string;
  status: string;
  billingCycle: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  source: "stripe" | "granted";
  updatedAt: string;
};

export type AdminPlansData = { billing: BillingOverview; plans: AdminPlan[]; recent: AdminSubscriptionRow[]; error: string | null };

/** Everything on /admin/plans, read-only and real: plans as configured, subscribers by status from the database, revenue only from Stripe-billed subscriptions. */
export async function getAdminPlansData(): Promise<AdminPlansData> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [plansRes, breakdownRes, eventsRes, licencesRes, recentRes] = await Promise.all([
    admin.from("plans").select("id, slug, name, tier_order, monthly_price_pence, annual_price_pence, is_active, entitlements").order("tier_order"),
    admin.rpc("admin_subscription_breakdown"),
    admin.from("billing_events").select("event_type").gte("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
    admin.from("institution_licences").select("plan_id, seat_count").eq("is_active", true).lte("starts_at", now).or(`expires_at.is.null,expires_at.gt.${now}`),
    admin
      .from("subscriptions")
      .select("user_id, status, billing_cycle, current_period_end, cancel_at_period_end, stripe_subscription_id, updated_at, plans!inner(name, tier_order)")
      .gt("plans.tier_order", 0)
      .order("updated_at", { ascending: false })
      .limit(25),
  ]);

  const errors: string[] = [];
  if (plansRes.error) errors.push("plans");
  if (breakdownRes.error) errors.push("subscription totals");
  if (eventsRes.error) errors.push("billing events");
  if (licencesRes.error) errors.push("institution licences");
  if (recentRes.error) errors.push("recent subscriptions");

  const parsed = breakdownSchema.safeParse(breakdownRes.data ?? []);
  const rows = breakdownRes.error || !parsed.success ? [] : parsed.data;
  const events: Record<string, number> = {};
  for (const row of eventsRes.data ?? []) events[row.event_type] = (events[row.event_type] ?? 0) + 1;
  const billing = summariseBilling(rows, events);
  const byPlan = new Map(billing.byPlan.map((row) => [row.slug, row]));

  const licenceByPlan = new Map<string, { licences: number; seats: number }>();
  for (const licence of licencesRes.data ?? []) {
    const entry = licenceByPlan.get(licence.plan_id) ?? { licences: 0, seats: 0 };
    entry.licences += 1;
    entry.seats += licence.seat_count;
    licenceByPlan.set(licence.plan_id, entry);
  }

  const plans: AdminPlan[] = (plansRes.data ?? []).map((plan) => {
    const counts = byPlan.get(plan.slug);
    const licence = licenceByPlan.get(plan.id);
    return {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      tierOrder: plan.tier_order,
      monthlyPricePence: plan.monthly_price_pence,
      annualPricePence: plan.annual_price_pence,
      isActive: plan.is_active,
      entitlements: (plan.entitlements ?? {}) as Record<string, unknown>,
      active: counts?.active ?? 0,
      trialing: counts?.trialing ?? 0,
      pastDue: counts?.pastDue ?? 0,
      canceled: counts?.canceled ?? 0,
      mrrPence: counts?.mrrPence ?? 0,
      licences: licence?.licences ?? 0,
      licensedSeats: licence?.seats ?? 0,
    };
  });

  const recentRows = (recentRes.data ?? []) as unknown as {
    user_id: string;
    status: string;
    billing_cycle: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    stripe_subscription_id: string | null;
    updated_at: string;
    plans: { name: string } | { name: string }[];
  }[];
  const ids = recentRows.map((row) => row.user_id);
  const { data: profiles } = ids.length ? await admin.from("profiles").select("id, full_name").in("id", ids) : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const recent: AdminSubscriptionRow[] = recentRows.map((row) => ({
    userId: row.user_id,
    fullName: names.get(row.user_id) ?? null,
    planName: (Array.isArray(row.plans) ? row.plans[0]?.name : row.plans?.name) ?? "Unknown",
    status: row.status,
    billingCycle: row.billing_cycle,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    source: row.stripe_subscription_id ? "stripe" : "granted",
    updatedAt: row.updated_at,
  }));

  return { billing, plans, recent, error: errors.length ? `Some figures couldn't be loaded: ${errors.join(", ")}.` : null };
}
