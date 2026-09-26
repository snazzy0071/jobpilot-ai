import { createClient } from "@supabase/supabase-js";
import { test, expect as baseExpect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { makeSuperAdmin, markOnboarded } from "../support/roles";

// Comparison pages (/compare/[slug]) against the REAL database. Every competitor here is a FICTIONAL test fixture ("E2E Testcorp",
// slug "e2ecmp-…") with made-up URLs on example.com — never real competitor data — created by the tests and deleted afterwards.
// The product ships with no competitor content: real facts are entered by an admin from the competitor's own pages.

test.describe.configure({ mode: "serial" });
const expect = baseExpect.configure({ timeout: 30_000 });
test.beforeEach(() => {
  test.setTimeout(240_000);
});

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();

function ukToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

const feat = (over: Record<string, unknown>) => ({ label: "Feature", competitor: "yes", competitorNote: null, jobpilot: "yes", jobpilotNote: null, sourceUrl: "https://example.com/testcorp/features", sourceDate: ukToday(-3), ...over });

const FULL = {
  slug: "e2ecmp-testcorp",
  competitor_name: "E2E Testcorp",
  competitor_website: "https://www.example.com/testcorp",
  intro: "E2E Testcorp is a fictional tool used only in tests.",
  features: [
    feat({ label: "Alpha checking", competitorNote: "Limited to one scan.", jobpilotNote: "Unlimited on paid plans." }),
    feat({ label: "Beta templates", competitor: "partial", jobpilot: "yes", sourceUrl: "https://example.com/testcorp/templates", sourceDate: ukToday(-2) }),
    feat({ label: "Gamma export", competitor: "no", jobpilot: "partial", sourceUrl: "https://example.com/testcorp/features", sourceDate: ukToday(-1) }), // same source as Alpha -> same number
    feat({ label: "Delta coaching", competitor: "unknown", jobpilot: "yes", sourceUrl: null, sourceDate: null }),
    feat({ label: "Epsilon legacy", sourceUrl: "https://example.com/testcorp/old", sourceDate: ukToday(-400) }),
  ],
  pricing: [{ plan: "Pro plan", price: "£9 a month (as published)", notes: "Billed monthly.", sourceUrl: "https://example.com/testcorp/pricing", sourceDate: ukToday(-3) }],
  differences: [{ title: "How results are shown", competitor: "A single score.", jobpilot: "A score plus a fix list.", sourceUrl: "https://example.com/testcorp/features", sourceDate: ukToday(-3) }],
  faqs: [
    { question: "Is E2E Testcorp free?", answer: "It has a free plan, according to its pricing page.", sourceUrl: "https://example.com/testcorp/pricing", sourceDate: ukToday(-3) },
    { question: "Can I use both?", answer: "Yes — nothing stops you.", sourceUrl: null, sourceDate: null },
  ],
  updated_on: ukToday(-3),
  published_at: new Date(Date.now() - 3600_000).toISOString(),
};

const MINIMAL = { slug: "e2ecmp-minimal", competitor_name: "E2E Minimalcorp", competitor_website: null, intro: null, features: [feat({ label: "Only feature" })], pricing: [], differences: [], faqs: [], updated_on: ukToday(-400), published_at: new Date(Date.now() - 3600_000).toISOString() };
const DRAFT = { ...FULL, slug: "e2ecmp-draft", competitor_name: "E2E Draftcorp", published_at: null };
const SCHEDULED = { ...FULL, slug: "e2ecmp-scheduled", competitor_name: "E2E Scheduledcorp", published_at: new Date(Date.now() + 7 * 86_400_000).toISOString() };

async function cleanup() {
  await db().from("comparison_pages").delete().like("slug", "e2ecmp-%");
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

async function go(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
}

test.afterAll(cleanup);

test.describe("public pages", () => {
  test.beforeAll(async () => {
    await cleanup();
    const { error } = await db().from("comparison_pages").insert([FULL, MINIMAL, DRAFT, SCHEDULED]);
    if (error) throw new Error(error.message);
    for (const path of ["/compare", "/compare/e2ecmp-testcorp", "/sitemap.xml"]) await fetch(`${BASE_URL}${path}`).catch(() => undefined);
  });

  test("the existing Compare page is intact and now lists the live comparisons by name", async ({ page }) => {
    await go(page, "/compare");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("stacks up");
    await expect(page.getByText("vs. general resume builders")).toBeVisible();
    await expect(page.getByText("Where JobPilot AI fits")).toBeVisible();
    const named = page.getByTestId("named-comparisons");
    await expect(named.getByRole("link", { name: /E2E Testcorp/ })).toHaveAttribute("href", "/compare/e2ecmp-testcorp");
    await expect(named.getByRole("link", { name: /E2E Minimalcorp/ })).toBeVisible();
    await expect(named).not.toContainText("Draftcorp");
    await expect(named).not.toContainText("Scheduledcorp");
    await expect(named.getByRole("link", { name: /E2E Testcorp/ })).toContainText(`checked ${longDate(ukToday(-3))}`);
  });

  test("a comparison shows features, pricing, differences and FAQs — each claim with its numbered source", async ({ page }) => {
    await go(page, "/compare/e2ecmp-testcorp");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("JobPilot AI vs E2E Testcorp");
    await expect(page.getByTestId("checked-date")).toHaveText(longDate(ukToday(-3)));
    await expect(page.getByTestId("checked").getByRole("link", { name: /example\.com/ })).toHaveAttribute("href", "https://www.example.com/testcorp");
    await expect(page.getByTestId("intro")).toContainText("fictional tool used only in tests");
    await expect(page.getByTestId("disclosure")).toContainText("competing product");
    await expect(page.getByTestId("stale-warning")).toHaveCount(0);

    const rows = page.getByTestId("feature-row");
    await expect(rows).toHaveCount(5);
    const row = (label: string) => rows.filter({ hasText: label });
    await expect(row("Alpha checking").getByTestId("competitor-cell")).toContainText("Yes");
    await expect(row("Alpha checking").getByTestId("competitor-cell")).toContainText("Limited to one scan.");
    await expect(row("Alpha checking").getByTestId("jobpilot-cell")).toContainText("Unlimited on paid plans.");
    await expect(row("Beta templates").getByTestId("competitor-cell")).toContainText("Partly");
    await expect(row("Gamma export").getByTestId("competitor-cell")).toContainText("No");
    await expect(row("Gamma export").getByTestId("jobpilot-cell")).toContainText("Partly");
    // Not confirmed is said plainly, with no source marker — nothing is guessed.
    await expect(row("Delta coaching").getByTestId("competitor-cell")).toContainText("Not confirmed");
    await expect(row("Delta coaching").getByTestId("source-ref")).toHaveCount(0);

    // Footnote numbers: one source = one number, in order of first appearance.
    await expect(row("Alpha checking").getByTestId("source-ref")).toHaveText("[1]");
    await expect(row("Gamma export").getByTestId("source-ref")).toHaveText("[1]"); // same URL as Alpha
    await expect(row("Beta templates").getByTestId("source-ref")).toHaveText("[2]");
    await expect(page.getByTestId("pricing-item").getByTestId("source-ref")).toHaveText("[4]"); // after Epsilon's [3]

    const pricing = page.getByTestId("pricing-item");
    await expect(pricing).toContainText("Pro plan");
    await expect(pricing.getByTestId("price")).toHaveText("£9 a month (as published)");
    await expect(page.getByTestId("pricing").getByRole("link", { name: "pricing page" })).toHaveAttribute("href", "/pricing");
    await expect(page.getByTestId("difference-item")).toContainText("A single score.");
    await expect(page.getByTestId("difference-item")).toContainText("A score plus a fix list.");
    await expect(page.getByTestId("faqs")).toContainText("Is E2E Testcorp free?");

    // Sources list: numbered, deduped, dated, linking out safely; clicking a marker goes to it.
    const sources = page.getByTestId("source-item");
    await expect(sources).toHaveCount(4); // features, templates, the old page, pricing — the difference and FAQ reuse two of them
    await expect(sources.nth(0)).toContainText("[1]");
    await expect(sources.nth(0).getByRole("link")).toHaveAttribute("href", "https://example.com/testcorp/features");
    await expect(sources.nth(0).getByRole("link")).toHaveAttribute("rel", /noopener/);
    await expect(sources.nth(0)).toContainText(`checked ${longDate(ukToday(-1))}`); // the latest check of that URL
    await expect(sources.nth(2).getByTestId("source-stale")).toBeVisible(); // Epsilon's source is 400 days old
    await expect(sources.nth(0).getByTestId("source-stale")).toHaveCount(0);
    await row("Beta templates").getByTestId("source-ref").click();
    await expect(page).toHaveURL(/#source-2$/);
    await expect(page.locator("#source-2")).toBeInViewport();
  });

  test("sections with nothing in them are absent, and an old check date is flagged", async ({ page }) => {
    await go(page, "/compare/e2ecmp-minimal");
    await expect(page.getByTestId("feature-row")).toHaveCount(1);
    for (const id of ["pricing", "differences", "faqs"]) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByTestId("intro")).toHaveCount(0);
    await expect(page.getByTestId("stale-warning")).toContainText("hasn't been rechecked in over 180 days");
    await expect(page.getByTestId("checked").getByRole("link")).toHaveCount(0); // no website given
  });

  test("drafts, scheduled and unknown comparisons are 404 and never leak", async ({ page }) => {
    for (const slug of ["e2ecmp-draft", "e2ecmp-scheduled", "no-such-competitor"]) {
      expect((await page.goto(`/compare/${slug}`))?.status(), slug).toBe(404);
      await expect(page.locator("body")).not.toContainText("Draftcorp");
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    }
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/compare/e2ecmp-testcorp");
    expect(sitemap).toContain("/compare/e2ecmp-minimal");
    expect(sitemap).not.toContain("e2ecmp-draft");
    expect(sitemap).not.toContain("e2ecmp-scheduled");
    expect(sitemap).toMatch(/\/compare</);
  });

  test("SEO and schema: title, description, canonical, WebPage + FAQPage + breadcrumbs, and no invented review markup", async ({ page }) => {
    await go(page, "/compare/e2ecmp-testcorp");
    await expect(page).toHaveTitle(/JobPilot AI vs E2E Testcorp \| JobPilot AI/);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toContain("JobPilot AI compared with E2E Testcorp");
    expect(description).toContain("5 features");
    expect(description).toContain(`information checked ${longDate(ukToday(-3))}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/compare\/e2ecmp-testcorp$/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /JobPilot AI vs E2E Testcorp/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    const lds = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
    const webpage = lds.find((ld) => ld["@type"] === "WebPage");
    expect(webpage.name).toBe("JobPilot AI vs E2E Testcorp");
    expect(webpage.dateModified).toBe(ukToday(-3));
    expect(webpage.about.map((a: { name: string }) => a.name)).toEqual(["JobPilot AI", "E2E Testcorp"]);
    const faq = lds.find((ld) => ld["@type"] === "FAQPage");
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(["Is E2E Testcorp free?", "Can I use both?"]);
    const crumbs = lds.find((ld) => ld["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Home", "Compare", "JobPilot AI vs E2E Testcorp"]);
    const all = JSON.stringify(lds);
    for (const banned of ["Review", "AggregateRating", "Product", "\"rating"]) expect(all).not.toContain(banned);

    // A page with no FAQs emits no FAQPage.
    await go(page, "/compare/e2ecmp-minimal");
    const minimal = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
    expect(minimal.some((ld) => ld["@type"] === "FAQPage")).toBe(false);
  });

  test("works at phone width with no horizontal scroll", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 375, height: 760 } });
    const page = await context.newPage();
    try {
      for (const url of ["/compare", "/compare/e2ecmp-testcorp"]) {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), url).toBeLessThanOrEqual(0);
      }
    } finally {
      await context.close();
    }
  });
});

test.describe("access control", () => {
  test("anonymous and ordinary users read live pages only and cannot write; the database refuses bad rows", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: visible } = await anon.from("comparison_pages").select("slug").like("slug", "e2ecmp-%");
    expect((visible ?? []).map((r) => r.slug).sort()).toEqual(["e2ecmp-minimal", "e2ecmp-testcorp"]);
    const forged = { slug: "e2ecmp-forged", competitor_name: "x", updated_on: ukToday() };
    expect((await anon.from("comparison_pages").insert(forged)).error).not.toBeNull();
    await anon.from("comparison_pages").update({ competitor_name: "hacked" }).eq("slug", "e2ecmp-testcorp");
    await anon.from("comparison_pages").delete().eq("slug", "e2ecmp-testcorp");
    expect((await db().from("comparison_pages").select("competitor_name").eq("slug", "e2ecmp-testcorp").single()).data!.competitor_name).toBe("E2E Testcorp");

    const user = await createIsolatedUser({ fullName: "Plain Compare User" });
    try {
      const signedIn = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      await signedIn.auth.signInWithPassword({ email: user.email, password: user.password });
      expect((await signedIn.from("comparison_pages").insert({ ...forged, slug: "e2ecmp-forged2" })).error).not.toBeNull();
      expect((await signedIn.from("comparison_pages").select("slug").eq("slug", "e2ecmp-draft")).data).toHaveLength(0);
    } finally {
      await deleteIsolatedUser(user.id);
    }

    const ok = { slug: "e2ecmp-bad", competitor_name: "Bad", updated_on: ukToday() };
    const bad = [{ ...ok, slug: "Bad Slug" }, { ...ok, features: { not: "an array" } }, { ...ok, competitor_website: "javascript:alert(1)" }, { ...ok, competitor_name: "" }, { ...ok, updated_on: null }, { ...ok, slug: "e2ecmp-testcorp" }];
    for (const row of bad) expect((await db().from("comparison_pages").insert(row as never)).error, JSON.stringify(row).slice(0, 50)).not.toBeNull();
  });
});

test.describe("admin", () => {
  test.beforeAll(cleanup);

  test("a staff account without the permission is turned away (the Blog and Advice Hub permissions don't grant it)", async ({ browser }) => {
    const user = await createIsolatedUser({ fullName: "Other Content Admin" });
    await markOnboarded(user.id);
    await db().from("profiles").update({ role: "admin" }).eq("id", user.id);
    const { data: role } = await db().from("admin_roles").insert({ slug: `e2e-cmp-other-${Date.now()}`, name: "E2E other", permissions: ["manage_blog", "manage_advice_hub"] }).select("id").single();
    await db().from("admin_user_roles").insert({ user_id: user.id, admin_role_id: role!.id });
    const { context, page } = await loginContext(browser, user);
    try {
      await page.waitForURL(/\/admin/);
      for (const url of ["/admin/compare", "/admin/compare/new"]) {
        await page.goto(url);
        await expect(page).toHaveURL(/\/admin$/);
      }
    } finally {
      await context.close();
      await deleteIsolatedUser(user.id);
      await db().from("admin_roles").delete().eq("id", role!.id);
    }
  });

  test("create with sources, preview, publish, correct the checked date, unpublish and delete — audited", async ({ browser, page: publicPage }) => {
    test.setTimeout(360_000);
    const admin = await createIsolatedUser({ fullName: "CMP Super Admin" });
    await makeSuperAdmin(admin.id);
    const { context, page } = await loginContext(browser, admin);
    const row = async (slug: string) => (await db().from("comparison_pages").select("*").eq("slug", slug).maybeSingle()).data;
    const listRow = (name: string) => page.getByTestId("admin-comparison-row").filter({ hasText: name });
    const frow = (i: number) => page.getByTestId("feature-row").nth(i);
    try {
      await page.waitForURL(/\/admin/);
      await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);

      await page.goto("/admin/compare");
      await expect(page.getByRole("link", { name: "Comparisons" }).first()).toBeVisible();
      await expect(page.getByText("No comparisons yet")).toBeVisible();

      // ---- create: every claim needs a source; nothing is saved by a failed attempt ----
      await page.getByRole("link", { name: "New comparison" }).click();
      await page.getByLabel("Competitor name").fill("E2E Admincorp");
      await page.getByLabel("URL slug").fill("e2ecmp-admincorp");
      await page.getByLabel("Competitor website (optional)").fill("https://example.com/admincorp");
      await page.getByLabel("Introduction (optional)").fill("Created through the admin form.");

      await page.getByRole("button", { name: "Add feature" }).click();
      await frow(0).getByLabel("Feature", { exact: true }).fill("Alpha checking");
      await frow(0).getByLabel("Competitor", { exact: true }).selectOption("yes");
      await expect(frow(0).getByLabel("Source link")).toBeVisible();
      await page.getByRole("button", { name: "Create comparison" }).click();
      await expect(page.getByRole("alert").filter({ hasText: '"Alpha checking" needs a source link' })).toBeVisible();

      await frow(0).getByLabel("Source link").fill("javascript:alert(1)");
      await frow(0).getByLabel("Date checked").fill(ukToday(-1));
      await page.getByRole("button", { name: "Create comparison" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "web links" })).toBeVisible();

      await frow(0).getByLabel("Source link").fill("https://example.com/admincorp/features");
      await frow(0).getByLabel("Date checked").fill("2099-01-01"); // the browser itself refuses a future check date (max = today); the server refuses it too (unit-tested)
      expect(await frow(0).getByLabel("Date checked").evaluate((el) => (el as HTMLInputElement).validity.rangeOverflow)).toBe(true);
      await frow(0).getByLabel("Date checked").fill(ukToday(-1));

      // a Not confirmed row needs (and shows) no source
      await page.getByRole("button", { name: "Add feature" }).click();
      await frow(1).getByLabel("Feature", { exact: true }).fill("Beta coaching");
      await expect(frow(1)).toContainText("Not confirmed — no source needed");
      await expect(frow(1).getByLabel("Source link")).toHaveCount(0);

      await page.getByRole("button", { name: "Add pricing note" }).click();
      const prow = page.getByTestId("pricing-row").first();
      await prow.getByLabel("Plan").fill("Plus");
      await prow.getByLabel("Price as published").fill("£12 a month");
      await prow.getByLabel("Source link").fill("https://example.com/admincorp/pricing");
      await page.getByRole("button", { name: "Add difference" }).click();
      const drow = page.getByTestId("difference-row").first();
      await drow.getByLabel("Title").fill("Fix lists");
      await drow.getByLabel("What the competitor does").fill("Shows a score.");
      await drow.getByLabel("What JobPilot AI does").fill("Shows a score and fixes.");
      await drow.getByLabel("Source link").fill("https://example.com/admincorp/features");
      await page.getByRole("button", { name: "Add FAQ" }).click();
      const qrow = page.getByTestId("faq-row").first();
      await qrow.getByLabel("Question").fill("Can I use both?");
      await qrow.getByLabel("Answer").fill("Yes.");
      await page.getByRole("button", { name: "Create comparison" }).click();
      await page.waitForURL(/\/admin\/compare$/);

      const created = (await row("e2ecmp-admincorp"))!;
      expect(created).toMatchObject({ competitor_name: "E2E Admincorp", competitor_website: "https://example.com/admincorp", published_at: null, updated_on: ukToday() });
      expect((created.features as { label: string; competitor: string; sourceUrl: string | null }[]).map((f) => [f.label, f.competitor, f.sourceUrl])).toEqual([["Alpha checking", "yes", "https://example.com/admincorp/features"], ["Beta coaching", "unknown", null]]);
      expect(created.pricing[0]).toMatchObject({ plan: "Plus", price: "£12 a month", sourceUrl: "https://example.com/admincorp/pricing" });
      await expect(listRow("E2E Admincorp").getByTestId("status")).toHaveText("Draft");
      await expect(listRow("E2E Admincorp")).toContainText("2 features · 1 pricing · 1 differences · 1 FAQs");
      expect((await publicPage.goto("/compare/e2ecmp-admincorp"))?.status()).toBe(404);

      // ---- preview: exactly what readers get, and it says it's ready ----
      await listRow("E2E Admincorp").getByRole("link", { name: "Preview E2E Admincorp" }).click();
      await expect(page.getByTestId("preview-banner")).toContainText("draft and not public");
      await expect(page.getByTestId("preview-ready")).toBeVisible();
      await expect(page.getByTestId("feature-row")).toHaveCount(2);
      await expect(page.getByTestId("price")).toHaveText("£12 a month");
      await page.goto("/admin/compare");

      // ---- publishing is refused while a claim has no source (seeded directly — the form would never allow it) ----
      const unsourced = { ...FULL, slug: "e2ecmp-unsourced", competitor_name: "E2E Unsourced", published_at: null, features: [feat({ label: "Naked claim", sourceUrl: null, sourceDate: null })] };
      expect((await db().from("comparison_pages").insert(unsourced)).error).toBeNull();
      await page.reload();
      await listRow("E2E Unsourced").getByRole("button", { name: "Publish E2E Unsourced" }).click();
      await expect(page.getByRole("alert").filter({ hasText: 'Can\'t publish yet: "Naked claim" needs a source.' })).toBeVisible();
      expect((await row("e2ecmp-unsourced"))!.published_at).toBeNull();
      await listRow("E2E Unsourced").getByRole("link", { name: "Preview E2E Unsourced" }).click();
      await expect(page.getByTestId("preview-blockers")).toContainText('"Naked claim" needs a source.');
      await page.goto("/admin/compare");

      // ---- publish a sourced one: it goes live, with its sources ----
      await listRow("E2E Admincorp").getByRole("button", { name: "Publish E2E Admincorp" }).click();
      await expect(listRow("E2E Admincorp").getByTestId("status")).toHaveText("Published");
      await publicPage.goto("/compare/e2ecmp-admincorp");
      await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText("JobPilot AI vs E2E Admincorp");
      await expect(publicPage.getByTestId("source-item")).toHaveCount(2);
      await expect(publicPage.getByTestId("feature-row").filter({ hasText: "Beta coaching" }).getByTestId("competitor-cell")).toContainText("Not confirmed");
      await publicPage.goto("/compare");
      await expect(publicPage.getByTestId("named-comparisons")).toContainText("E2E Admincorp");

      // ---- editing a live page can't strip a source; correcting the checked date updates it ----
      await listRow("E2E Admincorp").getByRole("link", { name: "Edit E2E Admincorp" }).click();
      await frow(0).getByLabel("Source link").fill("");
      await page.getByRole("button", { name: "Save comparison" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "needs a source link" })).toBeVisible();
      await frow(0).getByLabel("Source link").fill("https://example.com/admincorp/features-v2");
      await page.getByLabel("Information checked on").fill(ukToday(-2));
      await page.getByRole("button", { name: "Save comparison" }).click();
      await page.waitForURL(/\/admin\/compare$/);
      expect(await row("e2ecmp-admincorp")).toMatchObject({ updated_on: ukToday(-2) });
      await publicPage.goto("/compare/e2ecmp-admincorp");
      await expect(publicPage.getByTestId("checked-date")).toHaveText(longDate(ukToday(-2)));
      await expect(publicPage.getByTestId("source-item").first().getByRole("link")).toHaveAttribute("href", "https://example.com/admincorp/features-v2");

      // ---- unpublish, then delete ----
      await listRow("E2E Admincorp").getByRole("button", { name: "Move E2E Admincorp to drafts" }).click();
      await expect(listRow("E2E Admincorp").getByTestId("status")).toHaveText("Draft");
      expect((await publicPage.goto("/compare/e2ecmp-admincorp"))?.status()).toBe(404);
      page.once("dialog", (dialog) => void dialog.accept());
      await listRow("E2E Admincorp").getByRole("button", { name: "Delete E2E Admincorp" }).click();
      await expect(listRow("E2E Admincorp")).toHaveCount(0);
      expect(await row("e2ecmp-admincorp")).toBeNull();

      // ---- audit ----
      const { data: audit } = await db().from("admin_audit_logs").select("action").eq("actor_id", admin.id).eq("entity_type", "comparison_page");
      const actions = new Set(audit!.map((entry) => entry.action));
      for (const action of ["comparison_page.create", "comparison_page.update", "comparison_page.publish", "comparison_page.unpublish", "comparison_page.delete"]) {
        expect(actions.has(action), action).toBe(true);
      }
    } finally {
      await context.close();
      await deleteIsolatedUser(admin.id);
    }
  });
});
