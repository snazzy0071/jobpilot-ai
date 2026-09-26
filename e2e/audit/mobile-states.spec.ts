import { expect, test, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { makeInstitutionAdmin, makeSuperAdmin, markOnboarded, setPlan } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner } from "../support/cv-fixture";

// Every signed-in area at phone width (390px): no sideways scroll, no script error, no error screen, real content on screen. And the
// shared states: a branded 404 for unknown addresses, and not-found screens (with the right status) for records that don't exist.

test.describe.configure({ mode: "serial", timeout: 300_000 });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const PHONE = { width: 390, height: 800 };
const ZERO = "00000000-0000-4000-8000-000000000000";

const USER_PAGES = [
  "/dashboard", "/dashboard/cvs", "/dashboard/cover-letters", "/dashboard/cover-letters/new", "/dashboard/ats-scanner", "/dashboard/interview", "/dashboard/interview/new",
  "/dashboard/linkedin", "/dashboard/linkedin/new", "/dashboard/jobs", "/dashboard/applications", "/dashboard/applications/new", "/dashboard/applications/analytics",
  "/dashboard/test-prep", "/dashboard/test-prep/progress", "/dashboard/test-prep/daily", "/dashboard/auto-apply",
  ...["profile", "career", "account", "notifications", "privacy", "billing", "institution"].map((tab) => `/dashboard/settings?tab=${tab}`),
];
const ADMIN_PAGES = [
  "/admin", "/admin/users", "/admin/institutions", "/admin/plans", "/admin/access-codes", "/admin/ai-usage", "/admin/sponsors", "/admin/graduate-schemes", "/admin/graduate-schemes/new",
  "/admin/deadlines", "/admin/jobs", "/admin/test-prep", "/admin/advice-hub", "/admin/advice-hub/new", "/admin/blog", "/admin/blog/new", "/admin/compare", "/admin/compare/new",
  "/admin/auto-apply", "/admin/leads", "/admin/roles", "/admin/roles/new", "/admin/audit-log", "/admin/settings", "/admin/system-health", "/admin/email-logs",
];
const INSTITUTION_PAGES = ["/institution-admin", "/institution-admin/members", "/institution-admin/seats", "/institution-admin/invites", "/institution-admin/domains", "/institution-admin/licence", "/institution-admin/branding", "/institution-admin/analytics"];

const users: IsolatedUser[] = [];
const institutions: string[] = [];
const states = new Map<string, unknown>();

async function newUser(name: string): Promise<IsolatedUser> {
  const user = await createIsolatedUser({ fullName: name });
  await markOnboarded(user.id);
  users.push(user);
  return user;
}

async function signIn(browser: Browser, user: IsolatedUser, landing: RegExp) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/login");
  await dismissCookieBanner(page);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(landing, { timeout: 45_000 });
  states.set(user.id, await context.storageState());
  await context.close();
}

async function phone(browser: Browser, user: IsolatedUser): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE, storageState: states.get(user.id) as never });
  return context.newPage();
}

async function sweep(page: Page, paths: string[]) {
  const errors: string[] = [];
  let current = "";
  page.on("pageerror", (error) => errors.push(`${current}: ${error.message.slice(0, 80)}`));
  const problems: string[] = [];
  for (const path of paths) {
    current = path;
    const response = await page.goto(path, { waitUntil: "load" });
    await dismissCookieBanner(page);
    if (!response || response.status() >= 400) problems.push(`${path}: HTTP ${response?.status()}`);
    await page.waitForTimeout(300);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (wide > 1) problems.push(`${path}: sideways scroll (+${wide}px)`);
    if ((await page.locator("[data-route-error]").count()) > 0) problems.push(`${path}: error screen`);
    if ((await page.locator("#main-content").innerText().catch(() => "")).trim().length < 20) problems.push(`${path}: no content`);
  }
  expect(problems).toEqual([]);
  expect(errors).toEqual([]);
}

let member: IsolatedUser;
let admin: IsolatedUser;
let instAdmin: IsolatedUser;
let cvId = "";

test.beforeAll(async ({ browser }) => {
  member = await newUser("Mobile Member");
  await setPlan(member.id, "premium");
  cvId = (await seedCv(member.id, { title: "Mobile CV" })).cvId;
  await db().from("applications").insert({ user_id: member.id, company_name: "Mobile Co", job_title: "Mobile Role", status: "applied", applied_at: new Date().toISOString().slice(0, 10) });
  admin = await newUser("Mobile Admin");
  await makeSuperAdmin(admin.id);
  instAdmin = await newUser("Mobile Inst Admin");
  institutions.push(await makeInstitutionAdmin(instAdmin.id));
  await signIn(browser, member, /\/dashboard/);
  await signIn(browser, admin, /\/admin$/);
  await signIn(browser, instAdmin, /\/institution-admin$/);
});

test.afterAll(async () => {
  await db().from("admin_audit_logs").delete().eq("actor_id", admin.id);
  if (institutions.length) await db().from("institutions").delete().in("id", institutions);
  for (const user of users) await deleteIsolatedUser(user.id);
});

test("the user dashboard area works at phone width", async ({ browser }) => {
  const page = await phone(browser, member);
  await sweep(page, [...USER_PAGES, `/dashboard/cvs/${cvId}`]);
  await page.context().close();
});

test("a Test Prep quiz works at phone width: the pack page, a running session and a question with its answer options", async ({ browser }) => {
  const { data: pack } = await db().from("question_packs").select("id").eq("is_active", true).limit(1).single();
  const page = await phone(browser, member);
  await page.goto(`/dashboard/test-prep/practice/${pack!.id}`);
  await dismissCookieBanner(page);
  await expect(page.getByRole("button", { name: /^Practice/ })).toBeVisible();
  await page.getByRole("button", { name: /^Practice/ }).click();
  await expect(page.getByTestId("quiz-progress")).toBeVisible();
  await expect(page.getByRole("radio").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("radio").first().check({ force: true });
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("answer-feedback")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await db().from("test_sessions").delete().eq("user_id", member.id);
  await page.context().close();
});

test("the admin area works at phone width", async ({ browser }) => {
  const page = await phone(browser, admin);
  await sweep(page, ADMIN_PAGES);
  await page.context().close();
});

test("the institution-admin area works at phone width", async ({ browser }) => {
  const page = await phone(browser, instAdmin);
  await sweep(page, INSTITUTION_PAGES);
  await page.context().close();
});

test("unknown addresses get a branded 404, and records that don't exist get a not-found screen with a 404 status", async ({ browser }) => {
  const anonymous = await browser.newContext({ baseURL: BASE_URL, viewport: PHONE });
  const page = await anonymous.newPage();
  const response = await page.goto("/no-such-page-anywhere");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the homepage" })).toBeVisible();
  await anonymous.close();

  const user = await phone(browser, member);
  for (const path of [`/dashboard/cover-letters/${ZERO}`, `/dashboard/interview/${ZERO}`, `/dashboard/linkedin/${ZERO}`, `/dashboard/applications/${ZERO}/edit`, "/dashboard/nothing-here"]) {
    const res = await user.goto(path);
    // A path that matches no page is a real 404. A record that does not exist is found missing while the page streams, after the loading
    // skeleton has already been sent, so the status is 200 there; the person still sees the not-found screen (and search engines never see these).
    if (path.endsWith("nothing-here")) expect(res?.status(), path).toBe(404);
    if (path.endsWith("nothing-here")) {
      await expect(user.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible(); // the branded root 404
      continue;
    }
    await expect(user.locator("[data-route-not-found], [data-cv-not-found]").first(), path).toBeVisible();
    // Still inside the dashboard: the navigation is there, so the person isn't stranded.
    await expect(user.getByRole("link", { name: "Back to your dashboard" }).or(user.locator("[data-cv-not-found]"))).toBeVisible();
  }
  await user.context().close();

  const adminPage = await phone(browser, admin);
  for (const path of [`/admin/users/${ZERO}`, "/admin/nothing-here"]) {
    const res = await adminPage.goto(path);
    if (path.endsWith("nothing-here")) expect(res?.status(), path).toBe(404);
    await expect(adminPage.getByRole("heading", { name: "We couldn't find that page" }), path).toBeVisible();
  }
  await adminPage.context().close();

  const inst = await phone(browser, instAdmin);
  expect((await inst.goto("/institution-admin/nothing-here"))?.status()).toBe(404);
  await expect(inst.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await inst.context().close();
});
