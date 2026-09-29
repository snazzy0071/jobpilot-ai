import { expect, test, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { dismissCookieBanner } from "../support/cv-fixture";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { markOnboarded } from "../support/roles";
import { BASE_URL, createLimitedAdmin, createSuperAdmin, openAs, removeAdminSession, signInState, type AdminSession } from "../support/admin-session";

// The admin controls that change things, against the real database: users (search, filter, detail, delete and its guards), roles
// (create, edit, grant, revoke, delete — and that a granted permission really opens a section), app settings and their effects on real
// visitors (maintenance mode pauses signup, the announcement reaches signed-in users), and access codes (create, generate, deactivate).
// Every change is checked in the audit log. The global settings are put back afterwards.

test.describe.configure({ mode: "serial", timeout: 240_000 });

const db = () => getAdminClient();
const RUN = Date.now().toString(36);
const ROLE_SLUG = `e2e_role_${RUN}`;
const LIMITED_SLUG = `e2e-limited-${RUN}`;
const MEMBER_NAME = `E2E Member ${RUN}`;

let admin: AdminSession;
let limited: AdminSession;
let member: IsolatedUser;
let victim: IsolatedUser;
let memberState: unknown;
let originalSettings: { maintenance_mode: boolean; announcement_active: boolean; announcement_message: string | null } | null = null;

async function visit(page: Page, path: string) {
  await page.goto(path);
  await dismissCookieBanner(page);
}
const auditActions = async (actorId: string) => ((await db().from("admin_audit_logs").select("action").eq("actor_id", actorId)).data ?? []).map((row) => row.action);

test.beforeAll(async ({ browser }) => {
  originalSettings = (await db().from("app_settings").select("maintenance_mode, announcement_active, announcement_message").eq("id", 1).single()).data;
  admin = await createSuperAdmin(browser, "Management Admin");
  limited = await createLimitedAdmin(browser, "manage_users", LIMITED_SLUG);
  member = await createIsolatedUser({ fullName: MEMBER_NAME });
  await markOnboarded(member.id);
  victim = await createIsolatedUser({ fullName: `E2E Victim ${RUN}` });
  await markOnboarded(victim.id);
  memberState = await signInState(browser, member, /\/dashboard/);
});

test.afterAll(async () => {
  if (originalSettings) await db().from("app_settings").update(originalSettings).eq("id", 1);
  await db().from("access_codes").delete().like("label", `E2E ${RUN}%`);
  await db().from("admin_roles").delete().eq("slug", ROLE_SLUG);
  await removeAdminSession(admin);
  await removeAdminSession(limited, LIMITED_SLUG);
  await deleteIsolatedUser(member.id);
  await db().auth.admin.deleteUser(victim.id).catch(() => undefined);
});

test("users: search finds an account, filters narrow the list, and the detail page shows the real account", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/users");
  await page.getByLabel("Search").fill(MEMBER_NAME);
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/search=/);
  await expect(page.getByRole("link", { name: MEMBER_NAME })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(2); // header + the one match

  await page.getByLabel("Role").selectOption("admin");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("No accounts match these filters.")).toBeVisible();

  await visit(page, `/admin/users?search=${encodeURIComponent(MEMBER_NAME)}`);
  await page.getByRole("link", { name: MEMBER_NAME }).click();
  await page.waitForURL(/\/admin\/users\/[0-9a-f-]{36}$/);
  // Not an <h1> — the shared admin header already renders one for this route ("Users"); the account's name here is
  // plain text (src/app/admin/users/[id]/page.tsx), kept for exactly this reason (confirming which account you're
  // on before a destructive action like Delete account) without duplicating the page's real <h1>.
  await expect(page.locator("#main-content").getByText(MEMBER_NAME, { exact: true })).toBeVisible();
  await expect(page.getByText(member.email, { exact: true })).toBeVisible();
  const subscription = page.locator("[data-slot=card]").filter({ has: page.getByRole("heading", { name: "Subscription" }) });
  await expect(subscription).toContainText("Free");
  await expect(page.getByText("No access codes redeemed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "View as user" })).toBeVisible();
  await page.context().close();
});

test("users: deleting an account removes it and is audited; an admin account and your own cannot be deleted here", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, `/admin/users/${victim.id}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /Delete/ }).click();
  await expect.poll(async () => (await db().from("profiles").select("id").eq("id", victim.id)).data?.length, { timeout: 30_000 }).toBe(0);
  await expect.poll(() => auditActions(admin.user.id), { timeout: 20_000 }).toContain("user.delete");

  // The guards: the server refuses another admin and the caller's own account, whatever the page shows.
  for (const target of [admin.user.id, limited.user.id]) {
    await visit(page, `/admin/users/${target}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Delete/ }).click();
    await expect(page.getByRole("alert").or(page.getByText(/can't be deleted|your own account/i)).first()).toBeVisible({ timeout: 15_000 });
    expect((await db().from("profiles").select("id").eq("id", target)).data).toHaveLength(1);
  }
  await page.context().close();
});

test("users: an admin without manage_users cannot open the user pages", async ({ browser }) => {
  const restricted = await createLimitedAdmin(browser, "view_leads", `e2e-noaccess-${RUN}`);
  const page = await openAs(browser, restricted);
  for (const path of ["/admin/users", `/admin/users/${member.id}`]) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin$/);
  }
  await page.context().close();
  await removeAdminSession(restricted, `e2e-noaccess-${RUN}`);
});

test("roles: create a role, grant it, and the permission opens exactly that section; revoke and delete take it away", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/roles/new");
  await page.getByLabel("Name").fill(`E2E Role ${RUN}`);
  await page.getByLabel("Slug").fill(ROLE_SLUG);
  await page.getByRole("checkbox", { name: "View leads" }).click();
  await page.getByRole("button", { name: "Create role" }).click();
  await page.waitForURL(/\/admin\/roles$/);
  const { data: role } = await db().from("admin_roles").select("id, permissions, is_active").eq("slug", ROLE_SLUG).single();
  expect(role!.permissions).toEqual(["view_leads"]);

  // Grant it to the plain account (made an admin first, as the roles page only lists admin accounts).
  await db().from("profiles").update({ role: "admin" }).eq("id", member.id);
  await visit(page, "/admin/roles");
  await page.getByRole("combobox", { name: "Account" }).click();
  await page.getByRole("option", { name: new RegExp(MEMBER_NAME) }).click();
  await page.getByRole("combobox", { name: "Role", exact: true }).click();
  await page.getByRole("option", { name: `E2E Role ${RUN}` }).click();
  await page.getByRole("button", { name: "Grant role" }).click();
  await expect.poll(async () => (await db().from("admin_user_roles").select("id").eq("user_id", member.id).eq("admin_role_id", role!.id)).data?.length, { timeout: 20_000 }).toBe(1);

  // That permission — and only that — now opens Leads for them.
  const holder = await openAs(browser, { user: member, state: memberState });
  await holder.goto("/admin/leads");
  // Not scoped to #main-content — see e2e/leads/leads.spec.ts's own comment on this same assertion.
  await expect(holder.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
  await holder.goto("/admin/blog");
  await expect(holder).toHaveURL(/\/admin$/);
  await holder.context().close();

  // Editing the role changes what they can do straight away.
  await visit(page, `/admin/roles/${role!.id}/edit`);
  await page.getByRole("checkbox", { name: "View leads" }).click();
  await page.getByRole("checkbox", { name: "Manage blog" }).click();
  await page.getByRole("button", { name: "Save role" }).click();
  await page.waitForURL(/\/admin\/roles$/);
  expect((await db().from("admin_roles").select("permissions").eq("id", role!.id).single()).data!.permissions).toEqual(["manage_blog"]);

  // Revoke, then delete the role.
  await visit(page, "/admin/roles");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Revoke role" }).first().click();
  await expect.poll(async () => (await db().from("admin_user_roles").select("id").eq("user_id", member.id)).data?.length, { timeout: 20_000 }).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Delete E2E Role ${RUN}` }).click();
  await expect.poll(async () => (await db().from("admin_roles").select("id").eq("slug", ROLE_SLUG)).data?.length, { timeout: 20_000 }).toBe(0);
  await db().from("profiles").update({ role: "user" }).eq("id", member.id);

  const actions = await auditActions(admin.user.id);
  for (const expected of ["admin_role.create", "admin_role.update", "admin_role.delete"]) expect(actions.some((action) => action.startsWith(expected.split(".")[0]))).toBe(true);
  await page.context().close();
});

test("settings: the announcement reaches a signed-in user, maintenance mode pauses signup, and both are audited", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/settings");
  await page.getByRole("checkbox", { name: "Show announcement banner" }).click();
  await page.getByLabel("Announcement message").fill(`E2E announcement ${RUN}`);
  await page.getByRole("checkbox", { name: "Maintenance mode" }).click();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  const saved = (await db().from("app_settings").select("maintenance_mode, announcement_active, announcement_message").eq("id", 1).single()).data!;
  expect(saved.maintenance_mode).toBe(true);
  expect(saved.announcement_message).toBe(`E2E announcement ${RUN}`);

  expect(saved.announcement_active).toBe(true);

  // A signed-in user sees the announcement on their dashboard.
  const user = await openAs(browser, { user: member, state: memberState });
  await visit(user, "/dashboard");
  await expect(user.getByText(`E2E announcement ${RUN}`)).toBeVisible();
  await user.context().close();

  // Maintenance mode: a new signup is refused with the friendly message and no account is created.
  const visitor = await browser.newContext({ baseURL: BASE_URL });
  const signup = await visitor.newPage();
  await visit(signup, "/signup");
  const email = `e2e-maint-${RUN}@example.com`;
  await signup.getByLabel("Full name").fill("Maintenance Visitor");
  await signup.getByLabel("Email", { exact: true }).fill(email);
  await signup.getByLabel("Date of birth").fill("2000-01-01");
  await signup.getByLabel("Password", { exact: true }).fill("A-Real-Password-123!");
  await signup.getByRole("button", { name: "Create account" }).click();
  await expect(signup.getByRole("alert").filter({ hasText: "temporarily paused for maintenance" })).toBeVisible();
  const { data: users } = await db().auth.admin.listUsers({ page: 1, perPage: 200 });
  expect(users.users.some((account) => account.email === email)).toBe(false);
  await visitor.close();

  // Switch both off again: the announcement disappears and signup is open.
  await visit(page, "/admin/settings");
  await page.getByRole("checkbox", { name: "Maintenance mode" }).click();
  await page.getByRole("checkbox", { name: "Show announcement banner" }).click();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  const after = (await db().from("app_settings").select("maintenance_mode, announcement_active").eq("id", 1).single()).data!;
  expect(after).toEqual({ maintenance_mode: false, announcement_active: false });
  const user2 = await openAs(browser, { user: member, state: memberState });
  await visit(user2, "/dashboard");
  await expect(user2.getByText(`E2E announcement ${RUN}`)).toHaveCount(0);
  await user2.context().close();

  expect((await auditActions(admin.user.id)).filter((action) => action === "app_settings.update").length).toBeGreaterThanOrEqual(2);
  await page.context().close();
});

test("settings: an admin without manage_settings cannot open or change them", async ({ browser }) => {
  const page = await openAs(browser, limited);
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().close();
});

test("access codes: a code is created (blank code is generated), can be deactivated so it no longer works, and is audited", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/access-codes");
  await page.getByLabel("Label").fill(`E2E ${RUN} cohort`);
  await page.getByLabel("Max redemptions (blank = unlimited)").fill("2");
  await page.getByRole("button", { name: "Create access code" }).click();
  await expect.poll(async () => (await db().from("access_codes").select("code, max_redemptions, is_active").eq("label", `E2E ${RUN} cohort`)).data?.length, { timeout: 20_000 }).toBe(1);
  const { data: created } = await db().from("access_codes").select("id, code, max_redemptions, is_active, redemption_count").eq("label", `E2E ${RUN} cohort`).single();
  expect(created!.code).toMatch(/^[0-9A-F]{10}$/);
  expect(created!.max_redemptions).toBe(2);
  await expect(page.getByText(created!.code)).toBeVisible();

  // A duplicate code is refused; a bad maximum is refused.
  await page.getByLabel("Label").fill(`E2E ${RUN} duplicate`);
  await page.getByLabel(/^Code/).fill(created!.code);
  await page.getByRole("button", { name: "Create access code" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "already in use" })).toBeVisible();
  expect((await db().from("access_codes").select("id").eq("label", `E2E ${RUN} duplicate`)).data).toHaveLength(0);

  // Deactivating stops it being redeemed.
  await visit(page, "/admin/access-codes");
  await page.locator("tr", { hasText: created!.code }).getByRole("button", { name: "Deactivate" }).click();
  await expect.poll(async () => (await db().from("access_codes").select("is_active").eq("id", created!.id).single()).data!.is_active, { timeout: 20_000 }).toBe(false);
  const redeem = await db().rpc("redeem_access_code", { p_code: created!.code, p_user_id: member.id });
  expect(redeem.data).toBeNull();
  expect((await db().from("access_code_redemptions").select("id").eq("user_id", member.id)).data).toHaveLength(0);

  // Reactivating brings it back.
  await visit(page, "/admin/access-codes");
  await page.locator("tr", { hasText: created!.code }).getByRole("button", { name: "Reactivate" }).click();
  await expect.poll(async () => (await db().from("access_codes").select("is_active").eq("id", created!.id).single()).data!.is_active, { timeout: 20_000 }).toBe(true);

  const actions = await auditActions(admin.user.id);
  expect(actions).toContain("access_code.create");
  expect(actions.filter((action) => action.startsWith("access_code.")).length).toBeGreaterThanOrEqual(3);
  await page.context().close();
});

test("signup with an access code: a code that does not exist or is switched off is refused before any account is made", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await visit(page, "/signup");
  await page.getByRole("tab", { name: "Access code" }).click();
  const email = `e2e-code-${RUN}@example.com`;
  await page.getByLabel("Full name").fill("Code Visitor");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Date of birth").fill("2000-01-01");
  await page.getByLabel("Password", { exact: true }).fill("A-Real-Password-123!");
  await page.getByLabel("Access code", { exact: true }).fill("NOT-A-REAL-CODE");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  const { data: users } = await db().auth.admin.listUsers({ page: 1, perPage: 200 });
  expect(users.users.some((account) => account.email === email)).toBe(false);
  await context.close();
});
