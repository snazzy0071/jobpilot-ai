import { test, expect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { makeSuperAdmin, markOnboarded } from "../support/roles";

// Application deadlines (/deadlines), end to end against the REAL database. It shows graduate-scheme data, of which the
// real catalogue has none, so every row here is created by the test (employer "E2EDL…", slug "e2edl-…") and deleted after.

test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const PAGE = "/deadlines";

function ukToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

type Seed = Record<string, unknown>;
const base = (over: Seed): Seed => ({
  sector: "technology", is_rolling: false, is_published: true, study_stages: [], assessments: [], locations: [],
  sponsorship_status: "not_published", source_url: "https://example.com/e2e-dl-source", source_date: ukToday(-40), verified_at: ukToday(-10), ...over,
});

const SEEDS: Seed[] = [
  base({ slug: "e2edl-soon", employer: "E2EDL Soon", scheme_name: "Closing Soon Programme", sector: "law", locations: ["Leeds"], sponsorship_status: "sponsors", opens_on: ukToday(-20), deadline_on: ukToday(5) }),
  base({ slug: "e2edl-later", employer: "E2EDL Later", scheme_name: "Later Programme", sector: "banking_and_finance", locations: ["London", "Bristol"], sponsorship_status: "no", opens_on: ukToday(-60), deadline_on: ukToday(60) }),
  base({ slug: "e2edl-rolling", employer: "E2EDL Rolling", scheme_name: "Rolling Programme", sector: "technology", locations: ["London"], is_rolling: true, opens_on: ukToday(-100), sponsorship_status: "some_tracks" }),
  base({ slug: "e2edl-none", employer: "E2EDL None", scheme_name: "Undated Programme", sector: "consulting", source_date: ukToday(-500), verified_at: ukToday(-400) }),
  base({ slug: "e2edl-closed", employer: "E2EDL Closed", scheme_name: "Closed Programme", sector: "law", deadline_on: ukToday(-3), opens_on: ukToday(-90) }),
  base({ slug: "e2edl-upcoming", employer: "E2EDL Upcoming", scheme_name: "Upcoming Programme", sector: "consulting", opens_on: ukToday(20), deadline_on: ukToday(50) }),
  base({ slug: "e2edl-draft", employer: "E2EDL Draft", scheme_name: "Draft Programme", is_published: false, deadline_on: ukToday(3) }),
];

async function cleanup() {
  await db().from("graduate_schemes").delete().like("slug", "e2edl-%");
}

async function loginContext(browser: Browser, user: IsolatedUser) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  return { context, page };
}

const rows = (page: Page) => page.getByTestId("deadline-row");
const titles = (page: Page) => rows(page).locator("h3");
const row = (page: Page, title: string) => rows(page).filter({ hasText: title });

test.afterAll(cleanup);

test("an empty catalogue says so honestly and lists no dates", async ({ page }) => {
  await cleanup();
  const { count } = await db().from("graduate_schemes").select("id", { count: "exact", head: true });
  test.skip((count ?? 0) > 0, "the real catalogue already has schemes");
  await page.goto(PAGE);
  await expect(page.getByTestId("deadlines-empty")).toContainText("No deadlines to show yet");
  await expect(rows(page)).toHaveCount(0);
});

test.describe("public deadlines page", () => {
  test.beforeAll(async () => {
    await cleanup();
    const { error } = await db().from("graduate_schemes").insert(SEEDS);
    if (error) throw new Error(`seed failed: ${error.message}`);
  });

  test("groups schemes by what matters: closing soon, open, rolling, opening soon, no deadline, closed", async ({ page }) => {
    await page.goto(`${PAGE}?q=e2edl`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("application deadlines");
    await expect(page.getByTestId("result-count")).toContainText("6 schemes match your filters"); // the draft is excluded

    const order = ["closing_soon", "open", "rolling", "upcoming", "no_deadline", "closed"];
    const headings = await page.locator('section[data-testid^="group-"] h2').allTextContents();
    expect(headings.map((h) => h.replace(/\s*\(\d+\)\s*$/, ""))).toEqual(["Closing soon", "Open — with a deadline", "Rolling applications", "Opening soon", "No published deadline", "Closed"]);
    for (const [index, group] of order.entries()) {
      await expect(page.getByTestId(`group-${group}`)).toHaveCount(1);
      await expect(page.getByTestId(`group-${group}`).locator("h3")).toHaveCount(1, { timeout: 5000 });
      expect(await page.locator('section[data-testid^="group-"]').nth(index).getAttribute("data-testid")).toBe(`group-${group}`);
    }
    await expect(titles(page)).toHaveText(["Closing Soon Programme", "Later Programme", "Rolling Programme", "Upcoming Programme", "Undated Programme", "Closed Programme"]);
    await expect(page.getByText("Draft Programme")).toHaveCount(0);

    const soon = row(page, "Closing Soon Programme");
    await expect(soon.getByTestId("closing-soon-badge")).toBeVisible();
    await expect(soon.getByTestId("deadline-date")).toContainText(longDate(ukToday(5)));
    await expect(soon.getByTestId("deadline-date")).toContainText(longDate(ukToday(-20)));
    await expect(soon.getByTestId("countdown")).toHaveText("Closes in 5 days");
    await expect(soon.getByTestId("sponsorship-badge")).toContainText("Sponsors");
    await expect(soon).toContainText("Leeds");
    await expect(soon).toContainText("Law");

    await expect(row(page, "Later Programme").getByTestId("closing-soon-badge")).toHaveCount(0);
    await expect(row(page, "Later Programme").getByTestId("countdown")).toHaveText("Closes in 60 days");
    await expect(row(page, "Later Programme").getByTestId("sponsorship-badge")).toContainText("No");

    const rolling = row(page, "Rolling Programme");
    await expect(rolling.getByTestId("deadline-date")).toContainText("Rolling — no deadline");
    await expect(rolling.getByTestId("countdown")).toContainText("Rolling");

    const none = row(page, "Undated Programme");
    await expect(none.getByTestId("deadline-date")).toContainText("No published deadline");
    await expect(none.getByTestId("deadline-date")).toContainText("Not published"); // and no opening date either
    await expect(none.getByTestId("application-status")).toHaveText("Dates not published");
    await expect(none.getByTestId("stale-warning")).toBeVisible();

    await expect(row(page, "Upcoming Programme").getByTestId("countdown")).toHaveText("Opens in 20 days");
    await expect(row(page, "Closed Programme").getByTestId("application-status")).toHaveText("Closed");
    await expect(row(page, "Closed Programme").getByTestId("countdown")).toHaveText("Closed 3 days ago");
  });

  test("every row carries its source evidence", async ({ page }) => {
    await page.goto(`${PAGE}?q=e2edl`);
    for (let i = 0; i < 6; i++) {
      const evidence = rows(page).nth(i).getByTestId("evidence");
      const link = evidence.getByRole("link");
      await expect(link).toHaveAttribute("href", "https://example.com/e2e-dl-source");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
      await expect(evidence).toContainText("Source dated");
      await expect(evidence).toContainText("Dates verified");
    }
    await expect(row(page, "Later Programme").getByTestId("evidence")).toContainText(longDate(ukToday(-10)));
    await expect(row(page, "Later Programme").getByTestId("stale-warning")).toHaveCount(0);
    // A scheme title goes through to its full page.
    await row(page, "Later Programme").getByRole("link", { name: "Later Programme" }).click();
    await expect(page).toHaveURL(/\/graduate-schemes\/e2edl-later$/);
  });

  test("search, filters and sort work from the form and the URL", async ({ page }) => {
    await page.goto(`${PAGE}?q=e2edl`);
    await page.getByLabel("Applications", { exact: true }).selectOption("closing_soon");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/status=closing_soon/);
    await expect(titles(page)).toHaveText(["Closing Soon Programme"]);

    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/deadlines$/);

    const get = async (query: string) => {
      await page.goto(`${PAGE}?q=e2edl&${query}`);
      return titles(page).allTextContents();
    };
    expect(await get("status=no_deadline")).toEqual(["Rolling Programme", "Undated Programme"]);
    expect(await get("status=rolling")).toEqual(["Rolling Programme"]);
    expect(await get("status=closed")).toEqual(["Closed Programme"]);
    expect(await get("status=upcoming")).toEqual(["Upcoming Programme"]);
    expect(await get("status=open")).toEqual(["Closing Soon Programme", "Later Programme", "Rolling Programme"]);
    expect(await get("sector=law")).toEqual(["Closing Soon Programme", "Closed Programme"]);
    expect(await get("location=london")).toEqual(["Later Programme", "Rolling Programme"]);
    expect(await get("sponsorship=sponsors")).toEqual(["Closing Soon Programme"]);
    expect(await get("sponsorship=some_tracks")).toEqual(["Rolling Programme"]);
    expect(await get("sort=employer")).toEqual(["Closed Programme", "Later Programme", "Undated Programme", "Rolling Programme", "Closing Soon Programme", "Upcoming Programme"]);
    expect((await get("sort=opens"))[0]).toBe("Rolling Programme"); // opened 100 days ago: the earliest opening date
    expect(await get("sort=opens")).toHaveLength(6);
    expect(await get("sector=zzz&sort=zzz&status=zzz")).toHaveLength(6); // junk ignored
    expect(await get("sort=salary")).toHaveLength(6); // not offered here, falls back to the default

    // Flat lists (a status filter or a non-default sort) drop the grouping.
    await page.goto(`${PAGE}?q=e2edl&sort=employer`);
    await expect(page.locator('section[data-testid^="group-"]')).toHaveCount(0);
    await expect(page.getByTestId("deadline-list")).toBeVisible();

    await page.goto(`${PAGE}?q=e2edl&sector=law&location=nowhere`);
    await expect(page.getByTestId("deadlines-no-match")).toBeVisible();

    // Study-stage / assessment filters belong to the schemes finder, not this page.
    await expect(page.getByLabel("Study stage")).toHaveCount(0);
    for (const label of ["Sector", "Location", "Visa sponsorship", "Applications", "Sort by"]) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
  });

  test("SEO, sitemap, navigation and phone layout", async ({ page, browser }) => {
    await page.goto(PAGE);
    await expect(page).toHaveTitle(/Graduate Scheme Application Deadlines \| JobPilot AI/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/deadlines$/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const lds = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
    expect(lds.some((ld) => ld["@type"] === "BreadcrumbList")).toBe(true);
    const list = lds.find((ld) => ld["@type"] === "ItemList");
    expect(list.itemListElement.some((item: { url: string }) => item.url.endsWith("/graduate-schemes/e2edl-soon"))).toBe(true);
    expect(JSON.stringify(list)).not.toContain("e2edl-draft");

    await page.goto(`${PAGE}?status=closed`);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);

    expect(await (await page.request.get("/sitemap.xml")).text()).toContain("/deadlines<");
    await page.goto("/");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Application Deadlines" })).toBeVisible();

    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 375, height: 760 } });
    const phone = await context.newPage();
    try {
      await phone.goto(`${PAGE}?q=e2edl`);
      await expect(phone.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    } finally {
      await context.close();
    }
  });
});

// ---- admin: verify / update dates -----------------------------------------------------------------------------------------

test.describe("admin: verify and update dates", () => {
  test.beforeAll(async () => {
    await cleanup();
    await db().from("graduate_schemes").insert(SEEDS);
  });

  test("a staff account without the permission is turned away", async ({ browser }) => {
    const user = await createIsolatedUser({ fullName: "Limited DL Admin" });
    await markOnboarded(user.id);
    await db().from("profiles").update({ role: "admin" }).eq("id", user.id);
    const { data: role } = await db().from("admin_roles").insert({ slug: `e2e-dl-limited-${Date.now()}`, name: "E2E limited", permissions: ["manage_users"] }).select("id").single();
    await db().from("admin_user_roles").insert({ user_id: user.id, admin_role_id: role!.id });
    const { context, page } = await loginContext(browser, user);
    try {
      await page.waitForURL(/\/admin/);
      await page.goto("/admin/deadlines");
      await expect(page).toHaveURL(/\/admin$/);
    } finally {
      await context.close();
      await deleteIsolatedUser(user.id);
      await db().from("admin_roles").delete().eq("id", role!.id);
    }
  });

  test("verify a scheme and correct its dates, with the change audited and shown publicly", async ({ browser, page: publicPage }) => {
    test.setTimeout(240_000);
    const admin = await createIsolatedUser({ fullName: "DL Super Admin" });
    await makeSuperAdmin(admin.id);
    const { context, page } = await loginContext(browser, admin);
    const scheme = async (slug: string) => (await db().from("graduate_schemes").select("*").eq("slug", slug).single()).data!;
    const item = (title: string) => page.getByTestId("deadline-admin-row").filter({ hasText: title });
    try {
      await page.waitForURL(/\/admin/);
      await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);

      // The queue starts with the oldest check, and flags what needs verifying.
      await page.goto("/admin/deadlines");
      await expect(page.getByTestId("deadline-admin-row").first()).toContainText("Undated Programme");
      await expect(item("Undated Programme").getByTestId("verified")).toContainText("Needs verification");
      await expect(item("Later Programme").getByTestId("verified")).not.toContainText("Needs verification");
      await expect(item("Draft Programme")).toContainText("Draft");
      await page.getByLabel(/Only show dates not verified/).check();
      await expect(page.getByTestId("deadline-admin-row").filter({ hasText: "E2EDL" })).toHaveCount(1);
      await page.getByLabel(/Only show dates not verified/).uncheck();

      // ---- Mark verified: two steps, changes only the verification date ----
      const before = await scheme("e2edl-none");
      await item("Undated Programme").getByRole("button", { name: "Mark Undated Programme verified" }).click();
      await expect(page.getByRole("alertdialog")).toContainText("re-checked");
      await page.getByRole("button", { name: "Cancel" }).click();
      expect((await scheme("e2edl-none")).verified_at).toBe(before.verified_at); // cancelled: nothing changed
      await item("Undated Programme").getByRole("button", { name: "Mark Undated Programme verified" }).click();
      await page.getByRole("button", { name: "Yes, verified today" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Verified Undated Programme." })).toBeVisible();
      const after = await scheme("e2edl-none");
      expect(after.verified_at).toBe(ukToday());
      expect({ ...after, verified_at: null, updated_at: null }).toEqual({ ...before, verified_at: null, updated_at: null });
      await expect(item("Undated Programme").getByTestId("verified")).not.toContainText("Needs verification");
      await publicPage.goto("/deadlines?q=e2edl");
      await expect(row(publicPage, "Undated Programme").getByTestId("stale-warning")).toHaveCount(0);

      // ---- Edit dates: validation first ----
      const open = async (title: string) => {
        await item(title).getByRole("button", { name: `Edit dates for ${title}` }).click();
        return page.getByRole("form", { name: `Edit dates for ${title}` });
      };
      let form = await open("Later Programme");
      await form.getByLabel("Opening date").fill(ukToday(10));
      await form.getByLabel("Deadline").fill(ukToday(2));
      await form.getByRole("button", { name: "Save dates" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "deadline can't be before the opening date" })).toBeVisible();
      await form.getByLabel("Deadline").fill(ukToday(40));
      await form.getByLabel("Verified date").fill(ukToday(3));
      await form.getByRole("button", { name: "Save dates" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "can't be in the future" })).toBeVisible();
      await form.getByLabel("Verified date").fill(ukToday());
      await form.getByLabel("Source these dates were checked against").fill("javascript:alert(1)");
      await form.getByRole("button", { name: "Save dates" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /valid source URL/ })).toBeVisible();
      expect((await scheme("e2edl-later")).deadline_on).toBe(ukToday(60)); // nothing saved by the failed attempts

      // ---- a real correction: new deadline, cleared opening date, new evidence ----
      await form.getByLabel("Source these dates were checked against").fill("https://example.com/e2e-dl-new-source");
      await form.getByLabel("Opening date").fill("");
      await form.getByLabel("Deadline").fill(ukToday(9)); // now within the closing-soon window
      await form.getByLabel("Source date").fill(ukToday(-1));
      await form.getByRole("button", { name: "Save dates" }).click();
      await expect(page.getByRole("form", { name: "Edit dates for Later Programme" })).toHaveCount(0);
      const corrected = await scheme("e2edl-later");
      expect(corrected).toMatchObject({ opens_on: null, deadline_on: ukToday(9), source_url: "https://example.com/e2e-dl-new-source", source_date: ukToday(-1), verified_at: ukToday() });
      await expect(item("Later Programme").getByTestId("deadline")).toContainText("2"); // shows the new date
      await expect(item("Later Programme").getByTestId("opens")).toHaveText("Not published");

      // The public page reflects it at once: now closing soon, opening date not published, new source.
      await publicPage.goto("/deadlines?q=e2edl");
      const later = row(publicPage, "Later Programme");
      await expect(later.getByTestId("closing-soon-badge")).toBeVisible();
      await expect(later.getByTestId("countdown")).toHaveText("Closes in 9 days");
      await expect(later.getByTestId("deadline-date")).toContainText("Not published"); // the cleared opening date
      await expect(later.getByRole("link", { name: /example\.com/ })).toHaveAttribute("href", "https://example.com/e2e-dl-new-source");

      // Rolling on, deadline off.
      form = await open("Closing Soon Programme");
      await form.getByLabel("Deadline").fill("");
      await form.getByLabel("Rolling applications").check();
      await form.getByRole("button", { name: "Save dates" }).click();
      await expect(page.getByRole("form", { name: "Edit dates for Closing Soon Programme" })).toHaveCount(0);
      expect(await scheme("e2edl-soon")).toMatchObject({ deadline_on: null, is_rolling: true });
      await publicPage.goto("/deadlines?q=e2edl");
      await expect(row(publicPage, "Closing Soon Programme").getByTestId("deadline-date")).toContainText("Rolling — no deadline");
      await expect(publicPage.getByTestId("group-rolling").locator("h3")).toHaveText(["Rolling Programme", "Closing Soon Programme"]);

      // ---- audit: who changed what ----
      const { data: audit } = await db().from("admin_audit_logs").select("action, entity_id, metadata").eq("actor_id", admin.id).eq("entity_type", "graduate_scheme");
      const verify = audit!.find((entry) => entry.action === "graduate_scheme.verify");
      expect(verify?.entity_id).toBe(before.id);
      const update = audit!.find((entry) => entry.action === "graduate_scheme.dates_update" && entry.entity_id === corrected.id);
      expect(update?.metadata).toMatchObject({ before: { deadlineOn: ukToday(60) }, after: { opensOn: null, deadlineOn: ukToday(9), isRolling: false } });
    } finally {
      await context.close();
      await deleteIsolatedUser(admin.id);
    }
  });
});
