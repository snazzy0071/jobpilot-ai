import { expect, test, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { dismissCookieBanner } from "../support/cv-fixture";
import { createLimitedAdmin, createSuperAdmin, openAs, removeAdminSession, type AdminSession } from "../support/admin-session";

// The four read-only admin data views against rows this spec plants with known values (in a past day / a private template name so they
// cannot mix with real data): AI usage, email logs, audit log, system health. The figures on screen are compared with what was planted.

test.describe.configure({ mode: "serial", timeout: 180_000 });

const db = () => getAdminClient();
const RUN = Date.now().toString(36);
const TEMPLATE = `e2e_tpl_${RUN}`;
const DAY = "2020-01-15";
const NOON = `${DAY}T12:00:00Z`;
const LIMITED = `e2e-nodata-${RUN}`;

let admin: AdminSession;
let limited: AdminSession;

async function visit(page: Page, path: string) {
  await page.goto(path);
  await dismissCookieBanner(page);
}
const main = (page: Page) => page.locator("#main-content");

test.beforeAll(async ({ browser }) => {
  admin = await createSuperAdmin(browser, "Data Views Admin");
  limited = await createLimitedAdmin(browser, "manage_users", LIMITED);
  await db().from("ai_usage_logs").delete().like("operation", "e2e_%");
  const rows = [
    { operation: "e2e_rewrite", success: true, input_tokens: 100, output_tokens: 50, estimated_cost_usd: 0.001, duration_ms: 400 },
    { operation: "e2e_rewrite", success: true, input_tokens: 200, output_tokens: 100, estimated_cost_usd: 0.002, duration_ms: 600 },
    { operation: "e2e_rewrite", success: true, input_tokens: 300, output_tokens: 100, estimated_cost_usd: 0.003, duration_ms: 500 },
    { operation: "e2e_interview", success: false, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0, duration_ms: 1000, error_message: `e2e provider error ${RUN}` },
  ].map((row) => ({ ...row, user_id: admin.user.id, model: "e2e-model", created_at: NOON }));
  const { error } = await db().from("ai_usage_logs").insert(rows);
  if (error) throw new Error(error.message);
  const { error: mailError } = await db().from("email_send_logs").insert([
    { recipient: `sent1-${RUN}@example.com`, template: TEMPLATE, status: "sent", attempts: 1 },
    { recipient: `sent2-${RUN}@example.com`, template: TEMPLATE, status: "sent", attempts: 1 },
    { recipient: `failed-${RUN}@example.com`, template: TEMPLATE, status: "failed", attempts: 3, error_name: "rate_limit_exceeded" },
  ]);
  if (mailError) throw new Error(mailError.message);
  const { error: auditError } = await db().from("admin_audit_logs").insert([
    { actor_id: admin.user.id, actor_email: admin.user.email, action: `e2e.first.${RUN}`, entity_type: "e2e_entity", entity_id: "entity-1", metadata: { note: "planted" } },
    { actor_id: admin.user.id, actor_email: admin.user.email, action: `e2e.second.${RUN}`, entity_type: "e2e_other", entity_id: "entity-2", metadata: {} },
  ]);
  if (auditError) throw new Error(auditError.message);
});

test.afterAll(async () => {
  await db().from("ai_usage_logs").delete().like("operation", "e2e_%");
  await db().from("email_send_logs").delete().eq("template", TEMPLATE);
  await removeAdminSession(admin);
  await removeAdminSession(limited, LIMITED);
});

test("AI usage: the totals, per-feature figures, top users and failures match what was recorded", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, `/admin/ai-usage?from=${DAY}&to=${DAY}`);
  const tile = (label: string) => main(page).locator("[data-slot=card]").filter({ hasText: label }).first();
  await expect(tile("Total calls")).toContainText("4");
  await expect(tile("Success rate")).toContainText("75%");
  await expect(tile("Estimated cost")).toContainText("$0.006");

  const rewrite = main(page).getByRole("row", { name: /e2e_rewrite/ }).first();
  await expect(rewrite).toContainText("3"); // calls
  await expect(rewrite).toContainText("100%");
  await expect(rewrite).toContainText("850"); // 150 + 300 + 400 tokens
  await expect(main(page).getByRole("row", { name: /e2e_interview/ }).first()).toContainText("0%");

  await expect(main(page).getByRole("row").filter({ hasText: admin.user.email })).toContainText("4");
  await expect(main(page).getByText(`e2e provider error ${RUN}`)).toBeVisible();

  // A day with nothing in it is stated, not blank or broken.
  await visit(page, "/admin/ai-usage?from=2001-01-01&to=2001-01-01");
  await expect(main(page).getByText("No calls in this range.").first()).toBeVisible();
  await expect(main(page).getByText("No failed calls in this range.")).toBeVisible();
  await page.context().close();
});

test("email logs: every send is listed with its outcome, and the template and status filters narrow it", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, `/admin/email-logs?template=${TEMPLATE}`);
  await expect(main(page).getByRole("row")).toHaveCount(4); // header + 3
  await expect(main(page).getByRole("row", { name: new RegExp(`failed-${RUN}`) })).toContainText("failed");
  await expect(main(page).getByRole("row", { name: new RegExp(`failed-${RUN}`) })).toContainText("3");
  await expect(main(page).getByRole("row", { name: new RegExp(`sent1-${RUN}`) })).toContainText("sent");

  await visit(page, `/admin/email-logs?template=${TEMPLATE}&status=failed`);
  await expect(main(page).getByRole("row")).toHaveCount(2);
  await expect(main(page).getByText(`sent1-${RUN}@example.com`)).toHaveCount(0);

  await page.getByLabel("Template").selectOption(TEMPLATE); // the filter lists the template that was planted
  await page.context().close();
});

test("audit log: entries show who did what to what, and the type and search filters find them (also past the newest 200)", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/audit-log");
  await page.getByLabel("Search").fill(`e2e.first.${RUN}`);
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(main(page).getByText(`e2e.first.${RUN}`)).toBeVisible();
  await expect(main(page).getByText(`e2e.second.${RUN}`)).toHaveCount(0);
  await expect(main(page)).toContainText(admin.user.email);
  await expect(main(page)).toContainText("entity-1");
  await expect(main(page)).toContainText("planted");

  await visit(page, "/admin/audit-log?entityType=e2e_other");
  await expect(main(page).getByText(`e2e.second.${RUN}`)).toBeVisible();
  await expect(main(page).getByText(`e2e.first.${RUN}`)).toHaveCount(0);

  await visit(page, "/admin/audit-log?search=zz-no-such-entry-zz");
  await expect(main(page).getByText("No audit entries match these filters.")).toBeVisible();

  // Search reaches entries older than the newest 200 rows: plant 205 newer ones and look for the oldest planted entry again.
  const filler = Array.from({ length: 205 }, (_, index) => ({ actor_id: admin.user.id, actor_email: admin.user.email, action: `e2e.filler.${RUN}.${index}`, entity_type: "e2e_filler", metadata: {} }));
  await db().from("admin_audit_logs").insert(filler);
  await visit(page, `/admin/audit-log?search=${encodeURIComponent(`e2e.first.${RUN}`)}`);
  await expect(main(page).getByText(`e2e.first.${RUN}`)).toBeVisible();
  await page.context().close();
});

test("system health: each service reports a status with detail, and the public status page shows a summary without the detail", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/system-health");
  for (const label of ["Database", "AI (Claude)", "Payments (Stripe)", "Email delivery", "Job feed sync", "Sponsor register sync"]) {
    await expect(main(page).getByText(label, { exact: true }), label).toBeVisible();
  }
  // The database is reachable (the app is running on it) and every card carries one of the four states.
  await expect(main(page).locator("[data-slot=card]").filter({ hasText: "Database" }).first()).toContainText("Operational");
  const states = (await main(page).locator("[data-slot=badge]").allInnerTexts()).map((text) => text.trim());
  expect(states.length).toBeGreaterThanOrEqual(6);
  for (const state of states) expect(state).toMatch(/^(Operational|Degraded|Down|Not configured)$/);
  await expect(main(page).getByRole("link", { name: "Email logs" })).toBeVisible();

  await visit(page, "/status");
  await expect(page.getByText("Database").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("ANTHROPIC_API_KEY");
  await page.context().close();
});

test("an admin without these permissions is sent back to the dashboard from all four views", async ({ browser }) => {
  const page = await openAs(browser, limited);
  for (const path of ["/admin/ai-usage", "/admin/email-logs", "/admin/audit-log", "/admin/system-health"]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin$/);
  }
  await page.context().close();
});

test("overview: the 30-day tiles equal counts taken straight from the database", async ({ browser }) => {
  const page = await openAs(browser, admin);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 29);
  const since = start.toISOString();
  const count = async (table: string, column = "created_at") => (await db().from(table).select("id", { count: "exact", head: true }).gte(column, since)).count ?? 0;
  const tile = (label: string) => main(page).locator("[data-slot=card]").filter({ hasText: label }).first();

  await visit(page, "/admin");
  const expected: Record<string, number> = {
    "New users (30d)": await count("profiles"),
    "ATS scans (30d)": await count("ats_scans"),
    "CVs created (30d)": await count("cvs"),
    "Interviews (30d)": await count("interview_sessions"),
    "Applications (30d)": await count("applications"),
  };
  for (const [label, value] of Object.entries(expected)) {
    await tile(label).scrollIntoViewIfNeeded();
    await expect(tile(label), label).toContainText(value.toLocaleString("en-GB"), { timeout: 20_000 });
  }
  // The trends and panels are present (not the "unavailable" fallback).
  await expect(main(page).getByText(/couldn't be loaded|unavailable/i)).toHaveCount(0);
  await expect(main(page).getByRole("heading", { name: "New sign-ups" })).toBeVisible();
  await page.context().close();
});

test("the overview's aggregate functions cannot be called with the public key", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  for (const fn of ["admin_overview_daily", "admin_overview_snapshot"]) {
    const { data, error } = await anon.rpc(fn, fn === "admin_overview_daily" ? { p_days: 30 } : {});
    expect(error, fn).not.toBeNull();
    expect(data, fn).toBeNull();
  }
});
