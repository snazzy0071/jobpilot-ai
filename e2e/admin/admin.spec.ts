import { expect, test, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { makeSuperAdmin, markOnboarded, setPlan } from "../support/roles";
import { dismissCookieBanner } from "../support/cv-fixture";

// The admin area against the REAL database: login lands on /admin, the menu is exactly the requested one, the sidebar stays put while
// the content scrolls, there is no user-dashboard menu, View Public Website is there, permissions gate every section, and the
// numbers shown are the numbers in the database (users, subscriptions, revenue, Auto-Apply activity). Serial; two accounts sign in once each.

test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const RUN = Date.now().toString(36);

const MENU = [
  ["Dashboard", "/admin"],
  ["Users", "/admin/users"],
  ["Institutions", "/admin/institutions"],
  ["Plans/Subscriptions", "/admin/plans"],
  ["Access Codes", "/admin/access-codes"],
  ["AI Usage", "/admin/ai-usage"],
  ["Sponsors", "/admin/sponsors"],
  ["Graduate Schemes", "/admin/graduate-schemes"],
  ["Deadlines", "/admin/deadlines"],
  ["Jobs", "/admin/jobs"],
  ["Test Prep", "/admin/test-prep"],
  ["Advice Hub", "/admin/advice-hub"],
  ["Blog", "/admin/blog"],
  ["Comparisons", "/admin/compare"],
  ["Auto-Apply", "/admin/auto-apply"],
  ["Leads", "/admin/leads"],
  ["Roles", "/admin/roles"],
  ["Audit Log", "/admin/audit-log"],
  ["Settings", "/admin/settings"],
  ["System Health", "/admin/system-health"],
] as const;

let superAdmin: IsolatedUser;
let limited: IsolatedUser;
let member: IsolatedUser;
let states: { superAdmin?: unknown; limited?: unknown } = {};
const created: IsolatedUser[] = [];

async function signIn(browser: Browser, user: IsolatedUser, landing: RegExp): Promise<unknown> {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing, { timeout: 45_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}

async function open(browser: Browser, who: "superAdmin" | "limited", viewport = { width: 1360, height: 900 }): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, storageState: states[who] as never, viewport });
  return context.newPage();
}

const card = (page: Page, label: string) => page.locator("[data-slot=card]").filter({ has: page.getByRole("heading", { name: label, exact: true }) });
const gbp = (pence: number) => (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  superAdmin = await createIsolatedUser({ fullName: "Admin Tester" });
  await makeSuperAdmin(superAdmin.id);
  limited = await createIsolatedUser({ fullName: "Limited Admin" });
  await markOnboarded(limited.id);
  await db().from("profiles").update({ role: "admin" }).eq("id", limited.id);
  const { data: role } = await db().from("admin_roles").insert({ slug: `e2e-limited-${RUN}`, name: "E2E limited", permissions: ["manage_users"] }).select("id").single();
  await db().from("admin_user_roles").insert({ user_id: limited.id, admin_role_id: role!.id });
  member = await createIsolatedUser({ fullName: "Ordinary Member" });
  await markOnboarded(member.id);
  created.push(superAdmin, limited, member);
  // Admin login lands on /admin (never /dashboard).
  states = { superAdmin: await signIn(browser, superAdmin, /\/admin$/), limited: await signIn(browser, limited, /\/admin$/) };
});

test.afterAll(async () => {
  await db().from("admin_audit_logs").delete().in("actor_id", [superAdmin.id, limited.id]);
  await db().from("admin_roles").delete().eq("slug", `e2e-limited-${RUN}`);
  for (const user of created) await deleteIsolatedUser(user.id);
});

test.describe("shell and menu", () => {
  test("the menu is exactly the requested one, admin-only, with View Public Website and sign out", async ({ browser }) => {
    const page = await open(browser, "superAdmin");
    await page.goto("/admin");
    await dismissCookieBanner(page);
    const nav = page.locator("nav[aria-label='Main']");
    const links = nav.locator("a[href^='/admin']");
    await expect(links).toHaveCount(MENU.length);
    expect(await links.allInnerTexts()).toEqual(MENU.map(([label]) => label));
    for (const [index, [, href]] of MENU.entries()) await expect(links.nth(index)).toHaveAttribute("href", href);

    // No user-dashboard menu at all.
    await expect(nav.locator("a[href^='/dashboard']")).toHaveCount(0);
    for (const label of ["CV Builder", "My CVs", "ATS Scanner", "Interview Coach", "Job Feed", "Applications", "Cover Letters", "LinkedIn Optimiser"]) {
      await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
    // Email logs are not in the menu either, but System Health links to them.
    await expect(nav.getByRole("link", { name: "Email Logs" })).toHaveCount(0);

    const publicLink = nav.getByRole("link", { name: /View Public Website/ });
    await expect(publicLink).toHaveAttribute("href", "/");
    await expect(publicLink).toHaveAttribute("target", "_blank");
    await expect(nav.getByRole("button", { name: /sign out/i })).toBeVisible();
    await page.context().close();
  });

  test("every menu item opens its own page for a super admin (no redirects, no errors)", async ({ browser }) => {
    test.setTimeout(240_000);
    const page = await open(browser, "superAdmin");
    for (const [label, href] of MENU) {
      const response = await page.goto(href);
      expect(response?.status(), href).toBeLessThan(400);
      await expect(page, href).toHaveURL(new RegExp(`${href.replace(/\//g, "\\/")}$`));
      await expect(page.locator("#main-content"), label).toBeVisible();
      await expect(page.getByRole("alert").filter({ hasText: /couldn't be loaded|Something went wrong/i }), `${label} shows a load error`).toHaveCount(0);
    }
    await page.goto("/admin/system-health");
    await page.getByRole("link", { name: "Email logs" }).click();
    await expect(page).toHaveURL(/\/admin\/email-logs$/);
    await page.context().close();
  });

  test("desktop: the sidebar is fixed and only the content scrolls; mobile: a drawer", async ({ browser }) => {
    const page = await open(browser, "superAdmin", { width: 1360, height: 700 });
    await page.goto("/admin/plans");
    await dismissCookieBanner(page);
    const nav = page.locator("nav[aria-label='Main']");
    const before = await nav.boundingBox();
    const main = page.locator("#main-content");
    const scrollable = await main.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(scrollable).toBeGreaterThan(200);
    await main.evaluate((el) => el.scrollTo(0, 400));
    await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    const after = await nav.boundingBox();
    expect(after?.y).toBe(before?.y);
    expect(after?.height).toBe(before?.height);
    // The page itself never scrolls: one scrollbar, on the right, for the content.
    expect(await page.evaluate(() => document.documentElement.scrollTop)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1)).toBe(true);
    await page.context().close();

    const phone = await open(browser, "superAdmin", { width: 390, height: 800 });
    await phone.goto("/admin");
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await phone.getByRole("button", { name: /menu|navigation/i }).first().click();
    await expect(phone.getByRole("link", { name: "Plans/Subscriptions" })).toBeVisible();
    await phone.context().close();
  });

  test("a restricted admin sees only what their role allows, and every other section turns them away", async ({ browser }) => {
    const page = await open(browser, "limited");
    await page.goto("/admin");
    const links = page.locator("nav[aria-label='Main'] a[href^='/admin']");
    expect(await links.allInnerTexts()).toEqual(["Dashboard", "Users"]);
    for (const href of ["/admin/plans", "/admin/auto-apply", "/admin/institutions", "/admin/roles", "/admin/audit-log", "/admin/settings", "/admin/email-logs"]) {
      await page.goto(href);
      await expect(page, href).toHaveURL(/\/admin$/);
    }
    await page.context().close();
  });

  test("an ordinary account is kept out of /admin", async ({ browser }) => {
    const state = await signIn(browser, member, /\/dashboard$/);
    const context = await browser.newContext({ baseURL: BASE_URL, storageState: state as never });
    const page = await context.newPage();
    await page.goto("/admin/plans");
    await expect(page).not.toHaveURL(/\/admin/);
    await context.close();
  });
});

test.describe("real metrics", () => {
  test("dashboard totals match the database, and revenue counts only Stripe-billed subscriptions", async ({ browser }) => {
    // A paid plan that nothing is billing for (a grant): must show as complimentary, never as revenue.
    await setPlan(member.id, "premium");

    const [{ count: users }, { data: subs }] = await Promise.all([
      db().from("profiles").select("id", { count: "exact", head: true }),
      db().from("subscriptions").select("status, billing_cycle, stripe_subscription_id, plans(tier_order, monthly_price_pence, annual_price_pence)"),
    ]);
    let mrr = 0;
    let paying = 0;
    let complimentary = 0;
    for (const row of subs ?? []) {
      const plan = (Array.isArray(row.plans) ? row.plans[0] : row.plans) as { tier_order: number; monthly_price_pence: number; annual_price_pence: number } | null;
      if (row.status !== "active" || !plan || plan.tier_order === 0) continue;
      if (!row.stripe_subscription_id) {
        complimentary += 1;
        continue;
      }
      paying += 1;
      mrr += row.billing_cycle === "annual" ? Math.round(plan.annual_price_pence / 12) : plan.monthly_price_pence;
    }
    expect(complimentary).toBeGreaterThanOrEqual(1);

    const page = await open(browser, "superAdmin");
    await page.goto("/admin");
    await expect(card(page, "Total users")).toContainText((users ?? 0).toLocaleString("en-GB"), { timeout: 20_000 });
    await expect(card(page, "Paying subscriptions")).toContainText(String(paying), { timeout: 20_000 });
    await expect(card(page, "MRR")).toContainText(gbp(mrr), { timeout: 20_000 });

    await page.goto("/admin/plans");
    await expect(card(page, "MRR")).toContainText(gbp(mrr), { timeout: 20_000 });
    await expect(card(page, "Complimentary")).toContainText(String(complimentary), { timeout: 20_000 });
    await expect(card(page, "Paying subscriptions")).toContainText(String(paying), { timeout: 20_000 });

    // Per-plan active counts equal the database, row by row.
    const { data: plans } = await db().from("plans").select("id, slug");
    for (const plan of plans ?? []) {
      const { count } = await db().from("subscriptions").select("id", { count: "exact", head: true }).eq("plan_id", plan.id).eq("status", "active");
      await expect(page.locator(`[data-plan="${plan.slug}"] [data-col="active"]`), plan.slug).toHaveText(String(count ?? 0));
    }
    // The granted subscription is listed, labelled as granted rather than Stripe.
    await expect(page.getByRole("row").filter({ hasText: "Ordinary Member" })).toContainText("Granted");
    await page.context().close();
  });

  test("Auto-Apply figures match the database and expose no personal or job detail", async ({ browser }) => {
    const before = (await db().rpc("admin_auto_apply_overview")).data as { enabled: number; users_with_settings: number; queue_by_status: Record<string, number> };
    const secretCompany = `SECRET-EMPLOYER-${RUN}`;
    await db().from("auto_apply_settings").insert({ user_id: member.id, enabled: true, paused: false, consent_at: new Date().toISOString(), consent_version: "2026-09" });
    await db().from("auto_apply_queue").insert([
      { user_id: member.id, company_name: secretCompany, job_title: "Secret role", apply_url: "https://example.test/a", dedupe_key: `${RUN}|a`, status: "pending_review" },
      { user_id: member.id, company_name: secretCompany, job_title: "Secret role 2", apply_url: "https://example.test/b", dedupe_key: `${RUN}|b`, status: "needs_manual", adapter: "assisted" },
    ]);
    const { data: rows } = await db().from("auto_apply_queue").select("status");
    const expected = (status: string) => (rows ?? []).filter((row) => row.status === status).length;

    const page = await open(browser, "superAdmin");
    await page.goto("/admin/auto-apply");
    await expect(card(page, "Users with rules saved")).toContainText(String((before.users_with_settings ?? 0) + 1), { timeout: 20_000 });
    await expect(card(page, "Turned on")).toContainText(String((before.enabled ?? 0) + 1), { timeout: 20_000 });
    const queuePanel = page.locator("[data-slot=card]").filter({ has: page.getByRole("heading", { name: "Queue by status" }) });
    await expect(queuePanel.locator("div").filter({ hasText: /^Waiting for your review/ }).first()).toContainText(String(expected("pending_review")));
    await expect(queuePanel.locator("div").filter({ hasText: /^Apply yourself/ }).first()).toContainText(String(expected("needs_manual")));
    // Honest about what the deployment can do.
    await expect(page.getByTestId("auto-apply-adapters")).toContainText("hands the user the employer link");
    await expect(page.getByText(/No adapter submits applications/)).toBeVisible();
    // Aggregate only.
    const text = await page.locator("#main-content").innerText();
    for (const secret of [secretCompany, "Secret role", "example.test", "Ordinary Member", member.email]) expect(text).not.toContain(secret);
    await page.context().close();
    await db().from("auto_apply_queue").delete().eq("user_id", member.id);
    await db().from("auto_apply_settings").delete().eq("user_id", member.id);
  });

  test("the service-role-only admin functions are not callable with the public key", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    for (const fn of ["admin_subscription_breakdown", "admin_auto_apply_overview"]) {
      expect((await anon.rpc(fn)).error, fn).not.toBeNull();
    }
  });
});
