import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "user-1", email: "u@example.test" }) }));

let tables: Record<string, unknown> = {};
function builder(table: string) {
  const result = { data: tables[table] ?? null, error: null };
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = chain;
  b.eq = chain;
  b.single = () => Promise.resolve(result);
  b.maybeSingle = () => Promise.resolve(result);
  return b;
}
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: (table: string) => builder(table) })) }));

const stripe = {
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn(), update: vi.fn() },
};
vi.mock("@/lib/stripe/client", () => ({ getStripeClient: vi.fn(() => stripe) }));
vi.mock("@/lib/stripe/prices", () => ({ getStripePriceId: vi.fn((plan: string, cycle: string) => `price_${plan}_${cycle}`) }));
vi.mock("@/lib/stripe/customer", () => ({ resolveStripeCustomerId: vi.fn().mockResolvedValue("cus_1") }));

import { cancelSubscription, changeSubscriptionPlan, createBillingPortalSession, createCheckoutSession, reactivateSubscription } from "@/lib/billing/actions";

const plan = { id: "plan-pro", slug: "pro" };
const live = (over: Record<string, unknown> = {}) => ({ status: "active", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", billing_cycle: "monthly", cancel_at_period_end: false, plans: { slug: "pro" }, ...over });
const run = async (fn: () => Promise<unknown>) => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("REDIRECT:")) return { redirected: error.message.slice(9) };
    throw error;
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  tables = { plans: plan, subscriptions: null };
  stripe.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.test/s" });
  stripe.subscriptions.retrieve.mockResolvedValue({ items: { data: [{ id: "si_1" }] } });
  stripe.subscriptions.update.mockResolvedValue({});
  stripe.billingPortal.sessions.create.mockResolvedValue({ url: "https://portal.stripe.test/p" });
});

describe("createCheckoutSession", () => {
  it("starts a subscription checkout with a server-resolved price and the user's id", async () => {
    const result = await run(() => createCheckoutSession("premium", "annual", undefined, new FormData()));
    expect(result).toEqual({ redirected: "https://checkout.stripe.test/s" });
    const args = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(args).toMatchObject({ mode: "subscription", customer: "cus_1", client_reference_id: "user-1", line_items: [{ price: "price_premium_annual", quantity: 1 }] });
    expect(args.metadata).toMatchObject({ supabase_user_id: "user-1", plan_slug: "premium", billing_cycle: "annual" });
    expect(args.success_url).toContain("checkout=success");
  });
  it("refuses a plan or cycle outside the allowed set (nothing reaches Stripe)", async () => {
    // @ts-expect-error deliberately invalid input
    const result = await createCheckoutSession("enterprise", "monthly", undefined, new FormData());
    expect(result).toHaveProperty("error");
    // @ts-expect-error deliberately invalid input
    expect(await createCheckoutSession("pro", "weekly", undefined, new FormData())).toHaveProperty("error");
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("refuses to start a second subscription while one is live (would bill twice)", async () => {
    tables.subscriptions = live();
    const result = await createCheckoutSession("premium", "monthly", undefined, new FormData());
    expect(result).toEqual({ error: expect.stringMatching(/already have a subscription/) });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it("allows checkout again once the old subscription has ended, and for a granted plan nothing bills", async () => {
    tables.subscriptions = live({ status: "canceled" });
    expect(await run(() => createCheckoutSession("pro", "monthly", undefined, new FormData()))).toHaveProperty("redirected");
    tables.subscriptions = live({ stripe_subscription_id: null });
    expect(await run(() => createCheckoutSession("pro", "monthly", undefined, new FormData()))).toHaveProperty("redirected");
  });
  it("reports an unavailable plan, and a Stripe outage, without throwing", async () => {
    tables.plans = null;
    expect(await createCheckoutSession("pro", "monthly", undefined, new FormData())).toEqual({ error: "That plan isn't available right now." });
    tables.plans = plan;
    stripe.checkout.sessions.create.mockRejectedValue(new Error("network"));
    expect(await createCheckoutSession("pro", "monthly", undefined, new FormData())).toEqual({ error: expect.stringMatching(/nothing was changed/) });
  });
});

describe("changeSubscriptionPlan", () => {
  it("changes the price on the existing subscription with proration (an upgrade, a downgrade, or a cycle switch)", async () => {
    tables.subscriptions = live();
    expect(await run(() => changeSubscriptionPlan("premium", "monthly", undefined, new FormData()))).toEqual({ redirected: "/dashboard/settings?tab=billing&plan=updated" });
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", expect.objectContaining({ items: [{ id: "si_1", price: "price_premium_monthly" }], proration_behavior: "create_prorations" }));
    await run(() => changeSubscriptionPlan("pro", "annual", undefined, new FormData()));
    expect(stripe.subscriptions.update).toHaveBeenLastCalledWith("sub_1", expect.objectContaining({ items: [{ id: "si_1", price: "price_pro_annual" }] }));
  });
  it("refuses the plan and cycle the person is already on", async () => {
    tables.subscriptions = live();
    expect(await changeSubscriptionPlan("pro", "monthly", undefined, new FormData())).toEqual({ error: "You're already on that plan." });
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("starts a fresh checkout instead when there is no live subscription to change", async () => {
    tables.subscriptions = live({ status: "canceled" });
    expect(await run(() => changeSubscriptionPlan("premium", "monthly", undefined, new FormData()))).toEqual({ redirected: "https://checkout.stripe.test/s" });
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("turns a Stripe failure into a message and does not redirect as if it worked", async () => {
    tables.subscriptions = live();
    stripe.subscriptions.update.mockRejectedValue(new Error("boom"));
    expect(await changeSubscriptionPlan("premium", "monthly", undefined, new FormData())).toEqual({ error: expect.stringMatching(/nothing was changed/) });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("cancel and reactivate", () => {
  it("sets cancel_at_period_end only on a live subscription that is not already ending", async () => {
    tables.subscriptions = live();
    expect(await run(() => cancelSubscription(undefined, new FormData()))).toEqual({ redirected: "/dashboard/settings?tab=billing&plan=canceling" });
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    stripe.subscriptions.update.mockClear();
    tables.subscriptions = live({ cancel_at_period_end: true });
    expect(await cancelSubscription(undefined, new FormData())).toEqual({ error: expect.stringMatching(/already set to end/) });
    tables.subscriptions = live({ status: "canceled" });
    expect(await cancelSubscription(undefined, new FormData())).toEqual({ error: expect.stringMatching(/don't have an active subscription/) });
    tables.subscriptions = live({ stripe_subscription_id: null });
    expect(await cancelSubscription(undefined, new FormData())).toHaveProperty("error");
    expect(stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("reactivates only a subscription that is set to end", async () => {
    tables.subscriptions = live({ cancel_at_period_end: true });
    expect(await run(() => reactivateSubscription(undefined, new FormData()))).toEqual({ redirected: "/dashboard/settings?tab=billing&plan=reactivated" });
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: false });
    tables.subscriptions = live();
    expect(await reactivateSubscription(undefined, new FormData())).toEqual({ error: expect.stringMatching(/isn't set to end/) });
  });
});

describe("billing portal", () => {
  it("needs a Stripe customer, and opens the portal for that customer only", async () => {
    tables.subscriptions = null;
    expect(await createBillingPortalSession(undefined, new FormData())).toHaveProperty("error");
    tables.subscriptions = live();
    expect(await run(() => createBillingPortalSession(undefined, new FormData()))).toEqual({ redirected: "https://portal.stripe.test/p" });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_1" }));
  });
});
