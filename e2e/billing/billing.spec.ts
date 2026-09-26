import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { markOnboarded } from "../support/roles";
import { dismissCookieBanner } from "../support/cv-fixture";

// Billing and entitlements end to end against the REAL database, with Stripe's HTTP API mocked at the network layer (so the app's own
// checkout / portal / plan-change code runs unmodified) and webhooks delivered as genuinely SIGNED events to the real /api/stripe/webhook
// route. The mocked server must be started with the fake Stripe environment below; without it these tests skip.
//
//   NODE_OPTIONS="--import ./e2e/support/mock-providers/preload.mjs" E2E_MOCK_PROVIDERS=1 E2E_STRIPE_LOG=<file> STRIPE_SECRET_KEY=sk_test_e2e
//   STRIPE_WEBHOOK_SECRET=whsec_e2e STRIPE_PRICE_{PRO,PREMIUM,ELITE}_{MONTHLY,ANNUAL}=price_e2e_<plan>_<cycle> STRIPE_PRICE_VOICE_TOPUP=price_e2e_topup
//
// What Stripe itself does (its hosted checkout page, real card charges, the dashboard's portal configuration) is not testable here.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const LOG = process.env.E2E_STRIPE_LOG ?? "";
const db = () => getAdminClient();
const RUN = Date.now().toString(36);
const TOPUP_CREDITS = 5;

test.skip(!SECRET || !LOG || process.env.E2E_MOCK_PROVIDERS !== "1", "needs the mocked-Stripe server (see the header of this file)");
test.describe.configure({ mode: "serial", timeout: 150_000 });

const price = (plan: string, cycle: string) => `price_e2e_${plan}_${cycle}`;
const users: IsolatedUser[] = [];
const institutionIds: string[] = [];
const codes: string[] = [];

async function newUser(name: string): Promise<IsolatedUser> {
  const user = await createIsolatedUser({ fullName: name });
  await markOnboarded(user.id);
  users.push(user);
  return user;
}

const sessions = new Map<string, unknown>();
async function open(browser: Browser, user: IsolatedUser, path = "/dashboard/settings?tab=billing"): Promise<Page> {
  const saved = sessions.get(user.id);
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1360, height: 900 }, ...(saved ? { storageState: saved as never } : {}) });
  const page = await context.newPage();
  if (!saved) {
    await page.goto("/login");
    await dismissCookieBanner(page);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    sessions.set(user.id, await context.storageState());
  }
  await page.goto(path);
  await dismissCookieBanner(page);
  return page;
}

// ---- the Stripe request log ------------------------------------------------------------------------------------------------------

type StripeCall = { method: string; path: string; fields: Record<string, string> };
const stripeCalls = (): StripeCall[] => (existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) : []);
const callsSince = (mark: number) => stripeCalls().slice(mark);

// ---- signed webhook delivery -----------------------------------------------------------------------------------------------------

let eventCounter = 0;
function subscriptionObject(userId: string, customer: string, id: string, priceId: string, over: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id,
    object: "subscription",
    customer,
    status: "active",
    cancel_at_period_end: false,
    start_date: now,
    metadata: { supabase_user_id: userId },
    items: { object: "list", data: [{ id: "si_e2e", price: { id: priceId }, current_period_start: now, current_period_end: now + 30 * 86_400 }] },
    ...over,
  };
}

async function deliver(type: string, object: unknown, options: { created?: number; id?: string; signature?: "valid" | "bad" | "none" } = {}) {
  const event = { id: options.id ?? `evt_e2e_${RUN}_${++eventCounter}`, object: "event", type, created: options.created ?? Math.floor(Date.now() / 1000), data: { object } };
  const payload = JSON.stringify(event);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.signature !== "none") {
    headers["stripe-signature"] = Stripe.webhooks.generateTestHeaderString({ payload, secret: options.signature === "bad" ? "whsec_wrong" : SECRET });
  }
  const response = await fetch(`${BASE_URL}/api/stripe/webhook`, { method: "POST", headers, body: payload });
  return { status: response.status, event };
}

async function subscriptionRow(userId: string) {
  const { data } = await db().from("subscriptions").select("status, billing_cycle, cancel_at_period_end, stripe_customer_id, stripe_subscription_id, current_period_end, plans(slug)").eq("user_id", userId).single();
  const plans = data?.plans as { slug: string } | { slug: string }[] | null;
  return { ...data, plan: (Array.isArray(plans) ? plans[0]?.slug : plans?.slug) as string };
}

const billingEvents = async (userId: string) => ((await db().from("billing_events").select("event_type, stripe_event_id").eq("user_id", userId)).data ?? []);
const plan = (page: Page) => page.getByTestId("billing-panel");

async function planId(slug: string) {
  return (await db().from("plans").select("id").eq("slug", slug).single()).data!.id as string;
}
async function grantPlan(userId: string, slug: string, extra: Record<string, unknown> = {}) {
  const { error } = await db().from("subscriptions").upsert({ user_id: userId, plan_id: await planId(slug), status: "active", ...extra }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

test.afterAll(async () => {
  if (codes.length) await db().from("access_codes").delete().in("code", codes);
  if (institutionIds.length) await db().from("institutions").delete().in("id", institutionIds);
  for (const user of users) await deleteIsolatedUser(user.id);
});

// =====================================================================================================================================
test.describe("plans and prices as the database says", () => {
  test("the public pricing page shows the plans table's own prices and limits (not typed-in copy)", async ({ page }) => {
    const { data: plans } = await db().from("plans").select("slug, name, monthly_price_pence, annual_price_pence, entitlements").eq("is_active", true).order("tier_order");
    expect(plans!.map((p) => p.slug)).toEqual(["free", "pro", "premium", "elite"]);
    await page.goto(`${BASE_URL}/pricing`);
    await dismissCookieBanner(page);
    for (const p of plans!) {
      const card = page.locator("[data-slot=card]").filter({ has: page.getByRole("heading", { name: p.name, exact: true }) }).first();
      if (p.monthly_price_pence > 0) await expect(card).toContainText(`£${p.monthly_price_pence / 100}`);
    }
    await page.getByRole("switch", { name: "Toggle annual billing" }).click();
    for (const p of plans!.filter((x) => x.monthly_price_pence > 0)) {
      await expect(page.locator("[data-slot=card]").filter({ has: page.getByRole("heading", { name: p.name, exact: true }) }).first()).toContainText(`£${p.annual_price_pence / 100}`);
    }
    // The comparison table follows the entitlements: cover letters are off on Pro and on from Premium, exactly as enforced.
    const row = page.getByRole("row").filter({ hasText: "Cover Letter Generator" });
    const flags = await row.getByRole("cell").evaluateAll((cells) => cells.map((cell) => cell.querySelector("[aria-label]")?.getAttribute("aria-label")));
    const expected = plans!.map((p) => (p.entitlements.cover_letter_generator === true ? "Yes" : "No"));
    expect(flags).toEqual(expected);
    // No "unlimited ATS scans on Free" claim, which the Free entitlements (2 quick scans, 0 tailored) do not support.
    await expect(page.locator("body")).not.toContainText("Unlimited ATS scans");
    // Without Stripe configured for a real launch the page must not pretend to be live; here Stripe IS configured, so it doesn't say "launching soon".
    await expect(page.locator("body")).not.toContainText("Paid plans launching soon");
  });

  test("checkout prices are the ones in the server's price table for every paid plan and both cycles", async () => {
    expect(SECRET).toBeTruthy();
    // Sanity: the fake environment this run uses maps every (plan, cycle) to its own id, so the checkout test below can tell them apart.
    for (const plan of ["pro", "premium", "elite"]) for (const cycle of ["monthly", "annual"]) expect(process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`]).toBe(price(plan, cycle));
  });
});

// =====================================================================================================================================
test.describe("checkout, webhooks, plan changes, cancellation and payment failure", () => {
  let user: IsolatedUser;

  test.beforeAll(async () => {
    user = await newUser("Billing Tester");
  });

  test("a free account sees the free plan, the upgrade tiers, and is locked out of paid features", async ({ browser }) => {
    const page = await open(browser, user);
    await expect(plan(page)).toHaveAttribute("data-plan", "free");
    await expect(page.getByTestId("upgrade-tiers")).toBeVisible();
    await page.goto("/dashboard/auto-apply");
    await expect(page.getByTestId("auto-apply-locked")).toBeVisible();
    await page.goto("/dashboard/test-prep");
    await expect(page.getByTestId("test-prep-locked")).toBeVisible();
    await page.context().close();
  });

  test("Checkout is created server-side with the server's price, the user's id and no client-supplied amount (monthly and annual)", async ({ browser }) => {
    const page = await open(browser, user);
    let mark = stripeCalls().length;
    await page.getByRole("button", { name: /^Pro — £6\/mo$/ }).click();
    await page.waitForURL(/checkout=success/, { timeout: 30_000 });
    let checkout = callsSince(mark).find((call) => call.path === "/v1/checkout/sessions")!;
    expect(checkout.fields).toMatchObject({ mode: "subscription", client_reference_id: user.id, "line_items[0][price]": price("pro", "monthly"), "line_items[0][quantity]": "1", "metadata[plan_slug]": "pro", "metadata[billing_cycle]": "monthly", "metadata[supabase_user_id]": user.id });
    expect(checkout.fields["success_url"]).toContain("checkout=success");
    expect(checkout.fields["customer"]).toMatch(/^cus_mock_/);

    await page.goto("/dashboard/settings?tab=billing");
    mark = stripeCalls().length;
    await page.getByRole("tab", { name: "annual" }).click();
    await page.getByRole("button", { name: /^Premium — £150\/yr$/ }).click();
    await page.waitForURL(/checkout=success/, { timeout: 30_000 });
    checkout = callsSince(mark).find((call) => call.path === "/v1/checkout/sessions")!;
    expect(checkout.fields).toMatchObject({ "line_items[0][price]": price("premium", "annual"), "metadata[plan_slug]": "premium", "metadata[billing_cycle]": "annual" });
    // One Stripe customer for this user, reused.
    expect(callsSince(mark).filter((call) => call.path === "/v1/customers")).toHaveLength(0);
    await page.context().close();
  });

  test("the success redirect grants nothing: the database still says Free, and the banner does not claim a subscription", async ({ browser }) => {
    expect((await subscriptionRow(user.id)).plan).toBe("free");
    const page = await open(browser, user, "/dashboard/settings?tab=billing&checkout=success");
    await expect(page.getByTestId("billing-notice")).toContainText("waiting for Stripe");
    await expect(page.getByTestId("billing-notice")).not.toContainText("You're on");
    await expect(plan(page)).toHaveAttribute("data-plan", "free");
    // The same for every URL a person could type by hand.
    for (const query of ["plan=updated", "plan=reactivated", "topup=success"]) {
      await page.goto(`/dashboard/settings?tab=billing&${query}`);
      await expect(plan(page)).toHaveAttribute("data-plan", "free");
      await expect(page.locator("body")).not.toContainText(/has been updated|is active and will renew|are in this month's allowance/);
    }
    await page.goto("/dashboard/auto-apply?plan=elite&checkout=success");
    await expect(page.getByTestId("auto-apply-locked")).toBeVisible();
    await page.context().close();
  });

  test("webhooks: signature required; a valid subscription event sets plan, cycle, status and period from Stripe's data", async ({ browser }) => {
    const row = await subscriptionRow(user.id);
    const customer = row.stripe_customer_id!;
    expect(customer).toMatch(/^cus_mock_/);
    const sub = subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("pro", "monthly"));

    expect((await deliver("customer.subscription.created", sub, { signature: "none" })).status).toBe(400);
    expect((await deliver("customer.subscription.created", sub, { signature: "bad" })).status).toBe(400);
    expect((await subscriptionRow(user.id)).plan).toBe("free");

    const first = await deliver("customer.subscription.created", sub);
    expect(first.status).toBe(200);
    expect(await subscriptionRow(user.id)).toMatchObject({ plan: "pro", status: "active", billing_cycle: "monthly", stripe_subscription_id: `sub_e2e_${RUN}a`, cancel_at_period_end: false });

    // Delivered twice (Stripe retries): applied once.
    const before = (await billingEvents(user.id)).filter((e) => e.stripe_event_id === first.event.id).length;
    expect((await deliver("customer.subscription.created", sub, { id: first.event.id })).status).toBe(200);
    expect((await billingEvents(user.id)).filter((e) => e.stripe_event_id === first.event.id)).toHaveLength(before);

    const page = await open(browser, user);
    await expect(plan(page)).toHaveAttribute("data-plan", "pro");
    await expect(page.getByTestId("billing-plan-name")).toHaveText("Pro");
    await expect(page.getByTestId("billing-detail")).toContainText("Renews on");
    // The upgrade tiers are gone (no second subscription can be started from here); management is offered instead.
    await expect(page.getByTestId("upgrade-tiers")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Manage billing" })).toBeVisible();
    await page.context().close();
  });

  test("feature gating follows the plan the database records: Pro unlocks Pro features but not Premium ones", async ({ browser }) => {
    const page = await open(browser, user, "/dashboard/auto-apply");
    await expect(page.getByTestId("auto-apply-locked")).toBeVisible();
    await page.goto("/dashboard/test-prep");
    await expect(page.getByTestId("test-prep-locked")).toBeVisible();
    await page.context().close();
  });

  test("billing portal: opens for this user's own Stripe customer", async ({ browser }) => {
    const page = await open(browser, user);
    const mark = stripeCalls().length;
    await page.getByRole("button", { name: "Manage billing" }).click();
    await expect.poll(() => callsSince(mark).some((call) => call.path === "/v1/billing_portal/sessions"), { timeout: 30_000 }).toBe(true);
    const portal = callsSince(mark).find((call) => call.path === "/v1/billing_portal/sessions")!;
    expect(portal.fields.customer).toBe((await subscriptionRow(user.id)).stripe_customer_id);
    await page.context().close();
  });

  test("upgrade: asks Stripe to change the price with proration; the plan changes only when the webhook says so", async ({ browser }) => {
    const page = await open(browser, user);
    const mark = stripeCalls().length;
    await page.getByRole("button", { name: "Switch to Premium" }).click();
    await page.waitForURL(/plan=updated/, { timeout: 30_000 });
    const calls = callsSince(mark);
    expect(calls.some((call) => call.method === "GET" && call.path === `/v1/subscriptions/sub_e2e_${RUN}a`)).toBe(true);
    const update = calls.find((call) => call.method === "POST" && call.path === `/v1/subscriptions/sub_e2e_${RUN}a`)!;
    expect(update.fields).toMatchObject({ "items[0][id]": "si_mock_item", "items[0][price]": price("premium", "monthly"), proration_behavior: "create_prorations", "metadata[plan_slug]": "premium" });
    // Not yet: the row is unchanged and the banner only says it was requested.
    expect((await subscriptionRow(user.id)).plan).toBe("pro");
    await expect(page.getByTestId("billing-notice")).toContainText("requested");

    const customer = (await subscriptionRow(user.id)).stripe_customer_id!;
    await deliver("customer.subscription.updated", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("premium", "monthly")));
    expect((await subscriptionRow(user.id)).plan).toBe("premium");
    expect((await billingEvents(user.id)).map((e) => e.event_type)).toContain("subscription_upgraded");
    await page.reload();
    await expect(page.getByTestId("billing-plan-name")).toHaveText("Premium");
    await page.goto("/dashboard/auto-apply");
    await expect(page.getByTestId("auto-apply-locked")).toHaveCount(0);
    await page.goto("/dashboard/test-prep");
    await expect(page.getByTestId("test-prep-locked")).toHaveCount(0);
    await page.context().close();
  });

  test("switching between monthly and annual billing changes the price on the same subscription", async ({ browser }) => {
    const page = await open(browser, user);
    const mark = stripeCalls().length;
    await page.getByRole("button", { name: "Switch to annual billing" }).click();
    await page.waitForURL(/plan=updated/, { timeout: 30_000 });
    const update = callsSince(mark).find((call) => call.method === "POST" && call.path === `/v1/subscriptions/sub_e2e_${RUN}a`)!;
    expect(update.fields["items[0][price]"]).toBe(price("premium", "annual"));
    const customer = (await subscriptionRow(user.id)).stripe_customer_id!;
    await deliver("customer.subscription.updated", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("premium", "annual")));
    expect(await subscriptionRow(user.id)).toMatchObject({ plan: "premium", billing_cycle: "annual" });
    await page.reload();
    await expect(page.getByRole("button", { name: "Switch to monthly billing" })).toBeVisible();
    await page.context().close();
  });

  test("downgrade takes features away as soon as the webhook lands", async ({ browser }) => {
    const customer = (await subscriptionRow(user.id)).stripe_customer_id!;
    await deliver("customer.subscription.updated", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("pro", "monthly")));
    expect(await subscriptionRow(user.id)).toMatchObject({ plan: "pro", billing_cycle: "monthly" });
    expect((await billingEvents(user.id)).map((e) => e.event_type)).toContain("subscription_downgraded");
    const page = await open(browser, user, "/dashboard/auto-apply");
    await expect(page.getByTestId("auto-apply-locked")).toBeVisible();
    await page.context().close();
  });

  test("an event that arrives late (older than one already applied) cannot overwrite newer state", async () => {
    const customer = (await subscriptionRow(user.id)).stripe_customer_id!;
    const stale = await deliver("customer.subscription.updated", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("elite", "annual")), { created: Math.floor(Date.now() / 1000) - 3600 });
    expect(stale.status).toBe(200);
    expect(await subscriptionRow(user.id)).toMatchObject({ plan: "pro", billing_cycle: "monthly" });
  });

  test("cancel sets cancel-at-period-end in Stripe; access continues to the period end; reactivate undoes it", async ({ browser }) => {
    const page = await open(browser, user);
    let mark = stripeCalls().length;
    await page.getByRole("button", { name: "Cancel subscription" }).click();
    await page.waitForURL(/plan=canceling/, { timeout: 30_000 });
    expect(callsSince(mark).find((call) => call.method === "POST" && call.path.startsWith("/v1/subscriptions/"))!.fields).toMatchObject({ cancel_at_period_end: "true" });
    expect((await subscriptionRow(user.id)).cancel_at_period_end).toBe(false);
    await expect(page.getByTestId("billing-notice")).toContainText("once Stripe confirms");

    const customer = (await subscriptionRow(user.id)).stripe_customer_id!;
    await deliver("customer.subscription.updated", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("pro", "monthly"), { cancel_at_period_end: true }));
    await page.reload();
    await expect(page.getByTestId("billing-detail")).toContainText("Ends on");
    await expect(page.getByTestId("billing-plan-name")).toHaveText("Pro"); // still Pro until the period ends
    await expect(page.getByRole("button", { name: "Reactivate" })).toBeVisible();

    mark = stripeCalls().length;
    await page.getByRole("button", { name: "Reactivate" }).click();
    await page.waitForURL(/plan=reactivated/, { timeout: 30_000 });
    expect(callsSince(mark).find((call) => call.method === "POST" && call.path.startsWith("/v1/subscriptions/"))!.fields).toMatchObject({ cancel_at_period_end: "false" });
    await deliver("customer.subscription.updated", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("pro", "monthly")));
    await page.reload();
    await expect(page.getByTestId("billing-detail")).toContainText("Renews on");
    await page.context().close();
  });

  test("payment failure: past_due keeps the plan during Stripe's retries, warns the user, and a paid invoice clears it", async ({ browser }) => {
    const customer = (await subscriptionRow(user.id)).stripe_customer_id!;
    await deliver("invoice.payment_failed", { id: `in_e2e_${RUN}1`, object: "invoice", customer, amount_due: 600, currency: "gbp", attempt_count: 1 });
    expect((await subscriptionRow(user.id)).status).toBe("past_due");
    expect((await billingEvents(user.id)).map((e) => e.event_type)).toContain("payment_failed");
    const page = await open(browser, user);
    await expect(page.getByTestId("billing-past-due")).toBeVisible();
    await expect(page.getByTestId("billing-plan-name")).toHaveText("Pro");

    await deliver("invoice.paid", { id: `in_e2e_${RUN}2`, object: "invoice", customer, amount_paid: 600, currency: "gbp" });
    expect((await subscriptionRow(user.id)).status).toBe("active");
    await page.reload();
    await expect(page.getByTestId("billing-past-due")).toHaveCount(0);
    await page.context().close();
  });

  test("the subscription ending returns the user to Free, a late failure or stale update cannot bring it back, and they can subscribe again", async ({ browser }) => {
    const customer = (await subscriptionRow(user.id)).stripe_customer_id!;
    const deleted = await deliver("customer.subscription.deleted", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("pro", "monthly"), { status: "canceled" }));
    expect(deleted.status).toBe(200);
    expect((await subscriptionRow(user.id)).status).toBe("canceled");
    let page = await open(browser, user);
    await expect(plan(page)).toHaveAttribute("data-plan", "free");
    await expect(page.getByTestId("billing-ended")).toBeVisible();
    await expect(page.getByTestId("upgrade-tiers")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel subscription" })).toHaveCount(0);

    // Late events after the end must not revive it.
    await deliver("invoice.payment_failed", { id: `in_e2e_${RUN}3`, object: "invoice", customer, amount_due: 600, currency: "gbp", attempt_count: 2 });
    expect((await subscriptionRow(user.id)).status).toBe("canceled");
    await deliver("customer.subscription.updated", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("premium", "monthly")), { created: Math.floor(Date.now() / 1000) - 7200 });
    expect((await subscriptionRow(user.id)).status).toBe("canceled");
    await page.goto("/dashboard/auto-apply");
    await expect(page.getByTestId("auto-apply-locked")).toBeVisible();

    // Subscribing again works, and the old subscription's late deletion cannot cancel the new one.
    await deliver("customer.subscription.created", subscriptionObject(user.id, customer, `sub_e2e_${RUN}b`, price("premium", "monthly")));
    expect(await subscriptionRow(user.id)).toMatchObject({ plan: "premium", status: "active", stripe_subscription_id: `sub_e2e_${RUN}b` });
    await deliver("customer.subscription.deleted", subscriptionObject(user.id, customer, `sub_e2e_${RUN}a`, price("pro", "monthly"), { status: "canceled" }));
    expect(await subscriptionRow(user.id)).toMatchObject({ plan: "premium", status: "active" });
    // A second live subscription cannot replace the first either.
    await deliver("customer.subscription.created", subscriptionObject(user.id, customer, `sub_e2e_${RUN}c`, price("elite", "monthly")));
    expect(await subscriptionRow(user.id)).toMatchObject({ plan: "premium", stripe_subscription_id: `sub_e2e_${RUN}b` });
    page = await open(browser, user);
    await expect(page.getByTestId("billing-plan-name")).toHaveText("Premium");
    await page.context().close();
  });

  test("the user cannot write their own subscription, billing history, usage or top-ups through the API", async () => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    expect((await client.auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
    expect((await client.from("subscriptions").update({ plan_id: await planId("elite") }).eq("user_id", user.id).select()).data ?? []).toHaveLength(0);
    expect((await client.from("subscriptions").update({ status: "active" }).eq("user_id", user.id).select()).data ?? []).toHaveLength(0);
    expect((await client.from("billing_events").insert({ user_id: user.id, event_type: "payment_succeeded" })).error).not.toBeNull();
    expect((await client.from("voice_interview_topups").insert({ user_id: user.id, period_start: "2026-09-01T00:00:00Z", credits: 50, stripe_checkout_session_id: "cs_forged" })).error).not.toBeNull();
    expect((await client.from("subscription_usage").update({ used_count: 0 }).eq("user_id", user.id).select()).data ?? []).toHaveLength(0);
    // The usage functions are not callable with a user's key either (they were, before migration 0123).
    for (const [fn, args] of [
      ["release_usage", { p_user_id: user.id, p_metric: "voice_interviews_per_month", p_period_start: "2026-09-01T00:00:00Z", p_amount: 5 }],
      ["try_consume_usage", { p_user_id: user.id, p_metric: "x", p_period_start: "2026-09-01T00:00:00Z", p_period_end: "2026-10-01T00:00:00Z", p_limit: 1, p_amount: 1 }],
    ] as const) {
      expect((await client.rpc(fn, args)).error, fn).not.toBeNull();
    }
    expect((await db().from("subscriptions").select("plan_id").eq("user_id", user.id).single()).data?.plan_id).toBe(await planId("premium"));
  });
});

// =====================================================================================================================================
test.describe("usage limits, monthly reset and quotas", () => {
  const PERIOD = "2026-01-01T00:00:00.000Z";
  const NEXT = "2026-02-01T00:00:00.000Z";
  let user: IsolatedUser;
  const consume = async (metric: string, limit: number | null, period = PERIOD, end = NEXT, amount = 1) => {
    const { data, error } = await db().rpc("try_consume_usage", { p_user_id: user.id, p_metric: metric, p_period_start: period, p_period_end: end, p_limit: limit, p_amount: amount });
    expect(error).toBeNull();
    const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; used_count: number };
    return row;
  };

  test.beforeAll(async () => {
    user = await newUser("Usage Tester");
  });

  test("a metered limit is enforced atomically: exactly `limit` succeed, even when requests race", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => consume("chat_interviews_per_month", 4)));
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
    expect(Math.max(...results.map((r) => r.used_count))).toBe(4);
    expect((await consume("chat_interviews_per_month", 4)).allowed).toBe(false);
  });

  test("a refund frees exactly what was reserved, and unlimited (null) never blocks", async () => {
    expect((await db().rpc("release_usage", { p_user_id: user.id, p_metric: "chat_interviews_per_month", p_period_start: PERIOD, p_amount: 1 })).error).toBeNull();
    expect((await consume("chat_interviews_per_month", 4)).allowed).toBe(true);
    expect((await consume("chat_interviews_per_month", 4)).allowed).toBe(false);
    for (let i = 0; i < 5; i++) expect((await consume("ai_operations_per_month", null)).allowed).toBe(true);
  });

  test("a zero limit (feature not in the plan) blocks the first use", async () => {
    expect((await consume("voice_interviews_per_month", 0)).allowed).toBe(false);
  });

  test("usage resets with the calendar month: a new period starts from zero and the old one is untouched", async () => {
    const fresh = await consume("chat_interviews_per_month", 4, NEXT, "2026-03-01T00:00:00.000Z");
    expect(fresh).toMatchObject({ allowed: true, used_count: 1 });
    expect((await consume("chat_interviews_per_month", 4)).allowed).toBe(false); // the old month is still full
    const { data } = await db().from("subscription_usage").select("period_start, used_count").eq("user_id", user.id).eq("metric", "chat_interviews_per_month").order("period_start");
    expect(data!.map((row) => [new Date(row.period_start).toISOString(), row.used_count])).toEqual([[PERIOD, 4], [NEXT, 1]]);
  });

  test("the plan limits the app enforces are the ones in the plans table (Free 1 CV / 0 interviews, Premium 4 voice, Elite 10 voice + top-ups)", async () => {
    const { data } = await db().from("plans").select("slug, entitlements");
    const by = Object.fromEntries((data ?? []).map((p) => [p.slug, p.entitlements as Record<string, unknown>]));
    expect(by.free).toMatchObject({ cv_limit: 1, chat_interviews_per_month: 0, voice_interviews_per_month: 0, voice_topups_allowed: false, auto_apply: false });
    expect(by.pro).toMatchObject({ cv_limit: null, voice_interviews_per_month: 0, voice_topups_allowed: false, auto_apply: false });
    expect(by.premium).toMatchObject({ voice_interviews_per_month: 4, voice_topups_allowed: false, auto_apply: true, grad_scheme_prep: true, cover_letter_generator: true });
    expect(by.elite).toMatchObject({ voice_interviews_per_month: 10, voice_topups_allowed: true, chat_interviews_per_month: null, support_tier: "priority" });
  });
});

// =====================================================================================================================================
test.describe("voice quota and top-ups", () => {
  let user: IsolatedUser;
  const period = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  };

  test.beforeAll(async () => {
    user = await newUser("Voice Tester");
    await grantPlan(user.id, "elite", { stripe_customer_id: `cus_e2e_${RUN}v`, stripe_subscription_id: `sub_e2e_${RUN}v`, billing_cycle: "monthly" });
    // The whole monthly allowance (Elite: 10) used.
    await db().from("subscription_usage").insert({ user_id: user.id, metric: "voice_interviews_per_month", period_start: period(), period_end: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(), used_count: 10 });
  });

  test("an out-of-quota Elite user is offered a top-up; the purchase is a one-time payment with server-set credits and month", async ({ browser }) => {
    const page = await open(browser, user);
    await expect(page.getByTestId("billing-voice")).toContainText("10 of 10 used");
    const mark = stripeCalls().length;
    await page.getByRole("button", { name: `Buy ${TOPUP_CREDITS} more voice interviews` }).click();
    await expect.poll(() => callsSince(mark).some((call) => call.path === "/v1/checkout/sessions"), { timeout: 30_000 }).toBe(true);
    const checkout = callsSince(mark).find((call) => call.path === "/v1/checkout/sessions")!;
    expect(checkout.fields).toMatchObject({ mode: "payment", "line_items[0][price]": "price_e2e_topup", client_reference_id: user.id, "metadata[kind]": "voice_topup", "metadata[credits]": String(TOPUP_CREDITS), "metadata[period_start]": period() });
    // Nothing credited by the redirect.
    expect((await db().from("voice_interview_topups").select("id").eq("user_id", user.id)).data).toHaveLength(0);
    await page.goto("/dashboard/settings?tab=billing&topup=success");
    await expect(page.getByTestId("billing-notice")).toContainText("waiting for Stripe");
    await expect(page.getByTestId("billing-voice")).toContainText("10 of 10 used");
    await page.context().close();
  });

  test("the webhook credits the top-up once (and only once per Checkout Session), and the quota grows", async ({ browser }) => {
    const session = { id: `cs_e2e_${RUN}t`, object: "checkout.session", mode: "payment", customer: `cus_e2e_${RUN}v`, client_reference_id: user.id, metadata: { supabase_user_id: user.id, kind: "voice_topup", credits: String(TOPUP_CREDITS), period_start: period() } };
    const first = await deliver("checkout.session.completed", session);
    expect(first.status).toBe(200);
    await deliver("checkout.session.completed", session); // a different event id, same Checkout Session
    await deliver("checkout.session.completed", session, { id: first.event.id }); // the same event redelivered
    const { data } = await db().from("voice_interview_topups").select("credits").eq("user_id", user.id);
    expect(data).toEqual([{ credits: TOPUP_CREDITS }]);
    const page = await open(browser, user);
    await expect(page.getByTestId("billing-voice")).toContainText(`10 of ${10 + TOPUP_CREDITS} used`);
    await page.goto("/dashboard/settings?tab=billing&topup=success");
    await expect(page.getByTestId("billing-notice")).toContainText(`${TOPUP_CREDITS} added`);
    // Top-up metadata that does not add up credits nothing.
    await deliver("checkout.session.completed", { ...session, id: `cs_e2e_${RUN}bad`, metadata: { ...session.metadata, credits: "-3" } });
    expect((await db().from("voice_interview_topups").select("id").eq("user_id", user.id)).data).toHaveLength(1);
    await page.context().close();
  });

  test("a Premium user (no top-ups on the plan) is not offered one and is pointed to Elite", async ({ browser }) => {
    const premium = await newUser("Premium Voice");
    await grantPlan(premium.id, "premium", { stripe_customer_id: `cus_e2e_${RUN}p`, stripe_subscription_id: `sub_e2e_${RUN}p`, billing_cycle: "monthly" });
    await db().from("subscription_usage").insert({ user_id: premium.id, metric: "voice_interviews_per_month", period_start: period(), period_end: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(), used_count: 4 });
    const page = await open(browser, premium);
    await expect(page.getByTestId("billing-voice")).toContainText("4 of 4 used");
    await expect(page.getByRole("button", { name: /more voice interviews/ })).toHaveCount(0);
    await expect(page.getByTestId("billing-voice").getByRole("link", { name: "Upgrade to Elite" })).toBeVisible();
    await page.context().close();
  });
});

// =====================================================================================================================================
test.describe("access codes and institution licences", () => {
  test("an access code grants its plan without billing; a paying customer's plan is not replaced by a code; expired codes do nothing", async ({ browser }) => {
    const granted = await newUser("Code User");
    const code = `E2EB-${RUN}-A`.toUpperCase();
    codes.push(code);
    await db().from("access_codes").insert({ code, label: "e2e billing", granted_plan_id: await planId("premium"), max_redemptions: 5 });
    const redeemed = await db().rpc("redeem_access_code", { p_code: code, p_user_id: granted.id });
    expect(redeemed.error).toBeNull();
    expect(await subscriptionRow(granted.id)).toMatchObject({ plan: "premium", status: "active", stripe_subscription_id: null });
    const page = await open(browser, granted);
    await expect(plan(page)).toHaveAttribute("data-plan", "premium");
    await expect(page.getByTestId("billing-detail")).toContainText("aren't being billed");
    await expect(page.getByRole("button", { name: "Manage billing" })).toHaveCount(0); // nothing to manage: no Stripe subscription
    await expect(page.getByTestId("upgrade-tiers")).toBeVisible();
    await page.goto("/dashboard/auto-apply");
    await expect(page.getByTestId("auto-apply-locked")).toHaveCount(0);
    await page.context().close();

    // A customer with a live Stripe subscription keeps their own plan; the redemption is still recorded.
    const paying = await newUser("Paying Code User");
    await grantPlan(paying.id, "pro", { stripe_customer_id: `cus_e2e_${RUN}c`, stripe_subscription_id: `sub_e2e_${RUN}c`, billing_cycle: "monthly" });
    const second = await db().rpc("redeem_access_code", { p_code: code, p_user_id: paying.id });
    expect(second.error).toBeNull();
    expect((await subscriptionRow(paying.id)).plan).toBe("pro");
    expect((await db().from("access_code_redemptions").select("id").eq("user_id", paying.id)).data).toHaveLength(1);

    const expired = `E2EB-${RUN}-X`.toUpperCase();
    codes.push(expired);
    await db().from("access_codes").insert({ code: expired, label: "expired", granted_plan_id: await planId("elite"), expires_at: new Date(Date.now() - 86_400_000).toISOString() });
    const victim = await newUser("Expired Code User");
    expect((await db().rpc("redeem_access_code", { p_code: expired, p_user_id: victim.id })).data).toBeNull();
    expect((await subscriptionRow(victim.id)).plan).toBe("free");
    // A code used up to its limit stops working.
    const limited = `E2EB-${RUN}-L`.toUpperCase();
    codes.push(limited);
    await db().from("access_codes").insert({ code: limited, label: "single use", granted_plan_id: await planId("pro"), max_redemptions: 1 });
    const one = await newUser("One");
    const two = await newUser("Two");
    expect((await db().rpc("redeem_access_code", { p_code: limited, p_user_id: one.id })).data).not.toBeNull();
    expect((await db().rpc("redeem_access_code", { p_code: limited, p_user_id: two.id })).data).toBeNull();
    // Anyone holding the public key cannot redeem a code for someone else (they could before migration 0120).
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    expect((await anon.rpc("redeem_access_code", { p_code: code, p_user_id: two.id })).error).not.toBeNull();
  });

  test("an institution licence gives its members the plan while in force; the higher of licence and personal plan applies; expiry ends it", async ({ browser }) => {
    const member = await newUser("Licence Member");
    const { data: inst } = await db().from("institutions").insert({ name: `E2E Billing Inst ${RUN}`, slug: `e2e-billing-${RUN}` }).select("id").single();
    institutionIds.push(inst!.id);
    const { data: licence } = await db().from("institution_licences").insert({ institution_id: inst!.id, plan_id: await planId("premium"), seat_count: 5, starts_at: new Date(Date.now() - 86_400_000).toISOString() }).select("id").single();
    await db().from("institution_members").insert({ institution_id: inst!.id, user_id: member.id, role: "member" });

    const page = await open(browser, member);
    await expect(plan(page)).toHaveAttribute("data-plan", "premium");
    await expect(plan(page)).toHaveAttribute("data-source", "institution");
    await expect(page.getByTestId("billing-detail")).toContainText("institution's licence");
    await page.goto("/dashboard/auto-apply");
    await expect(page.getByTestId("auto-apply-locked")).toHaveCount(0);

    // Their own higher plan wins; an equal or lower one does not replace the licence.
    await grantPlan(member.id, "elite", { stripe_customer_id: `cus_e2e_${RUN}i`, stripe_subscription_id: `sub_e2e_${RUN}i`, billing_cycle: "monthly" });
    await page.goto("/dashboard/settings?tab=billing");
    await expect(plan(page)).toHaveAttribute("data-plan", "elite");
    await expect(plan(page)).toHaveAttribute("data-source", "subscription");

    // Licence expiry ends the licence plan, and a member with no plan of their own falls back to Free.
    await db().from("subscriptions").update({ plan_id: await planId("free"), stripe_subscription_id: null, stripe_customer_id: null }).eq("user_id", member.id);
    await db().from("institution_licences").update({ starts_at: new Date(Date.now() - 5 * 86_400_000).toISOString(), expires_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("id", licence!.id);
    await page.goto("/dashboard/settings?tab=billing");
    await expect(plan(page)).toHaveAttribute("data-plan", "free");
    await page.goto("/dashboard/auto-apply");
    await expect(page.getByTestId("auto-apply-locked")).toBeVisible();
    await page.context().close();
  });
});
