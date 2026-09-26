import { createClient } from "@supabase/supabase-js";
import { test, expect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { makeSuperAdmin, markOnboarded } from "../support/roles";
import { selectOption } from "../fixtures";

// Graduate schemes, end to end against the REAL database. Nothing is invented for the product: the catalogue starts empty
// and every row here is created by the test itself (employer names start "E2EGS", slugs "e2egs-") and removed afterwards.
// The "no schemes yet" state is only asserted while the real table is genuinely empty.

test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const LIST = "/graduate-schemes";

function ukToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

type Seed = Record<string, unknown>;
const base = (over: Seed): Seed => ({
  sector: "technology",
  is_rolling: false,
  is_published: true,
  study_stages: [],
  locations: [],
  sponsorship_status: "not_published",
  source_url: "https://example.com/e2e-source",
  source_date: ukToday(-40),
  verified_at: ukToday(-10),
  ...over,
});

const SEEDS: Seed[] = [
  base({
    slug: "e2egs-alpha", employer: "E2EGS Alpha", scheme_name: "Engineering Graduate Programme", sector: "engineering_and_manufacturing",
    description: "A two-year rotational programme in engineering.", salary: "£30,000", salary_min: 30000, salary_max: 30000,
    locations: ["Leeds", "London"], study_stages: ["final_year"], opens_on: ukToday(-10), deadline_on: ukToday(20),
    sponsorship_status: "sponsors",
    assessment_notes: "Tests are taken online.", application_url: "https://example.com/e2e-apply", notes: "Stated on the graduate visa page.",
  }),
  base({ slug: "e2egs-beta", employer: "E2EGS Beta", scheme_name: "Finance Scheme", sector: "banking_and_finance", locations: ["London"], study_stages: ["graduate"], is_rolling: true, sponsorship_status: "no", salary: "£45,000", salary_min: 45000, salary_max: 45000 }),
  base({ slug: "e2egs-gamma", employer: "E2EGS Gamma", scheme_name: "Law Training Contract", sector: "law", deadline_on: ukToday(-5), opens_on: ukToday(-60), application_url: "https://example.com/e2e-closed-apply" }),
  base({ slug: "e2egs-delta", employer: "E2EGS Delta", scheme_name: "Consulting Analyst", sector: "consulting", opens_on: ukToday(30), deadline_on: ukToday(60), sponsorship_status: "some_tracks" }),
  base({ slug: "e2egs-epsilon", employer: "E2EGS Epsilon", scheme_name: "Mystery Programme", sector: "other", source_date: ukToday(-500), verified_at: ukToday(-400) }),
  base({ slug: "e2egs-draft", employer: "E2EGS Draft", scheme_name: "Unpublished Programme", is_published: false }),
];

/** Alpha's assessment mappings (each with its own evidence) — schemes and their assessments are separate rows. */
async function seedMappings() {
  const { data: alpha } = await db().from("graduate_schemes").select("id").eq("slug", "e2egs-alpha").single();
  const { error } = await db().from("graduate_scheme_assessments").insert([
    { scheme_id: alpha!.id, assessment_type: "numerical", is_required: true, source_url: "https://example.com/e2e-selection", source_date: ukToday(-40), verified_at: ukToday(-10), display_order: 1 },
    { scheme_id: alpha!.id, assessment_type: "verbal", is_required: true, source_url: "https://example.com/e2e-selection", source_date: ukToday(-40), verified_at: ukToday(-10), display_order: 2 },
  ]);
  if (error) throw new Error(`mapping seed failed: ${error.message}`);
}

async function cleanup() {
  await db().from("graduate_schemes").delete().like("slug", "e2egs-%");
  await db().from("graduate_schemes").delete().like("employer", "E2EGS%");
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

async function dismissBanner(page: Page) {
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
}

const cards = (page: Page) => page.getByTestId("scheme-card");
const cardTitles = (page: Page) => cards(page).locator("h2");

test.afterAll(cleanup);

// ---- empty state ----------------------------------------------------------------------------------------------------

test("an empty catalogue says so honestly, with no invented schemes", async ({ page }) => {
  await cleanup();
  const { count } = await db().from("graduate_schemes").select("id", { count: "exact", head: true });
  test.skip((count ?? 0) > 0, "the real catalogue already has schemes");
  await page.goto(LIST);
  await expect(page.getByTestId("schemes-empty")).toContainText("No graduate schemes have been published yet");
  await expect(cards(page)).toHaveCount(0);
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/graduate-schemes<");
  expect(sitemap).not.toMatch(/\/graduate-schemes\/[a-z]/);
});

test.describe("public listing and detail", () => {
  test.beforeAll(async () => {
    await cleanup();
    const { error } = await db().from("graduate_schemes").insert(SEEDS);
    if (error) throw new Error(`seed failed: ${error.message}`);
    await seedMappings();
  });

  test("lists published schemes only, soonest deadline first, closed last", async ({ page }) => {
    await page.goto(`${LIST}?q=e2egs`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("graduate scheme");
    await expect(cards(page)).toHaveCount(5); // the draft is not listed
    await expect(page.getByTestId("result-count")).toContainText("5 schemes match your filters");
    await expect(cardTitles(page)).toHaveText([
      "Engineering Graduate Programme", // open, deadline in 20 days
      "Finance Scheme", // open, rolling
      "Consulting Analyst", // opens in 30 days
      "Mystery Programme", // no dates published
      "Law Training Contract", // closed
    ]);
    await expect(page.getByText("Unpublished Programme")).toHaveCount(0);

    const alpha = cards(page).filter({ hasText: "Engineering Graduate Programme" });
    await expect(alpha.getByTestId("application-status")).toHaveText("Open");
    await expect(alpha.getByTestId("timeline")).toContainText("Closes in 20 days");
    await expect(alpha).toContainText("£30,000");
    await expect(alpha).toContainText("Final-year students");
    await expect(alpha).toContainText("Leeds");
    await expect(alpha.getByTestId("sponsorship-badge")).toContainText("Visa sponsorship: Sponsors");
    await expect(cards(page).filter({ hasText: "Finance Scheme" }).getByTestId("timeline")).toContainText("Rolling");
    await expect(cards(page).filter({ hasText: "Law Training Contract" }).getByTestId("application-status")).toHaveText("Closed");
    await expect(cards(page).filter({ hasText: "Consulting Analyst" }).getByTestId("timeline")).toContainText("Opens in 30 days");
    // No date claims where the employer published none, and an old verification is flagged.
    const mystery = cards(page).filter({ hasText: "Mystery Programme" });
    await expect(mystery.getByTestId("application-status")).toHaveText("Dates not published");
    await expect(mystery.getByTestId("stale-warning")).toBeVisible();
    await expect(alpha.getByTestId("stale-warning")).toHaveCount(0);
  });

  test("search, filters and sort work from the form and from the URL", async ({ page }) => {
    await page.goto(`${LIST}?q=e2egs`);

    await page.getByLabel("Employer, programme or keyword").fill("e2egs london");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/q=e2egs\+london|q=e2egs%20london/);
    await expect(cardTitles(page)).toHaveText(["Engineering Graduate Programme", "Finance Scheme"]);

    await page.getByLabel("Study stage").selectOption("graduate");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(cardTitles(page)).toHaveText(["Finance Scheme"]);
    await expect(page).toHaveURL(/stage=graduate/);

    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/graduate-schemes$/);

    // Straight from a URL: sector, sponsorship, status, location, assessment.
    const titles = async (query: string) => {
      await page.goto(`${LIST}?q=e2egs&${query}`);
      return cardTitles(page).allTextContents();
    };
    expect(await titles("sector=law")).toEqual(["Law Training Contract"]);
    expect(await titles("sponsorship=sponsors")).toEqual(["Engineering Graduate Programme"]);
    expect(await titles("sponsorship=some_tracks")).toEqual(["Consulting Analyst"]);
    expect(await titles("status=closed")).toEqual(["Law Training Contract"]);
    expect(await titles("status=upcoming")).toEqual(["Consulting Analyst"]);
    expect(await titles("status=rolling")).toEqual(["Finance Scheme"]);
    expect(await titles("status=open")).toEqual(["Engineering Graduate Programme", "Finance Scheme"]);
    expect(await titles("location=leeds")).toEqual(["Engineering Graduate Programme"]);
    expect(await titles("assessment=numerical")).toEqual(["Engineering Graduate Programme"]);
    expect(await titles("sort=employer")).toEqual(["Engineering Graduate Programme", "Finance Scheme", "Consulting Analyst", "Mystery Programme", "Law Training Contract"]);
    expect((await titles("sort=salary")).slice(0, 2)).toEqual(["Finance Scheme", "Engineering Graduate Programme"]);

    // Junk in the URL is ignored, not trusted.
    expect((await titles("sector=%27%3Bdrop&sort=zzz&page=abc")).length).toBe(5);

    // No match.
    await page.goto(`${LIST}?q=e2egs&sector=law&stage=postgraduate`);
    await expect(page.getByTestId("schemes-no-match")).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
  });

  test("the filter form is labelled and keyboard-usable", async ({ page }) => {
    await page.goto(LIST);
    await expect(page.getByRole("search", { name: "Search graduate schemes" })).toBeVisible();
    for (const label of ["Sector", "Study stage", "Applications", "Visa sponsorship", "Location", "Assessment", "Sort by"]) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    }
    await page.getByLabel("Employer, programme or keyword").focus();
    await page.keyboard.type("e2egs alpha");
    await page.keyboard.press("Enter"); // submitting the form with the keyboard applies the search
    await expect(cardTitles(page)).toHaveText(["Engineering Graduate Programme"]);
  });

  test("a detail page shows every field, its source and honest dates", async ({ page }) => {
    await page.goto(`${LIST}?q=e2egs`);
    await cards(page).first().getByRole("link", { name: "Engineering Graduate Programme" }).click();
    await expect(page).toHaveURL(/\/graduate-schemes\/e2egs-alpha$/);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Engineering Graduate Programme");
    await expect(page.getByText("E2EGS Alpha · Engineering & Manufacturing")).toBeVisible();
    await expect(page.getByTestId("application-status")).toHaveText("Open");
    await expect(page.getByTestId("timeline")).toContainText("Closes in 20 days");
    await expect(page.getByTestId("description")).toContainText("two-year rotational programme");
    await expect(page.getByText("£30,000").first()).toBeVisible();
    await expect(page.getByText("Final-year students")).toBeVisible();
    await expect(page.getByText("Leeds")).toBeVisible();
    await expect(page.getByTestId("dates")).toContainText("Deadline");
    const closes = new Date(`${ukToday(20)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    await expect(page.getByTestId("dates")).toContainText(closes);
    await expect(page.getByTestId("assessment-name")).toHaveText(["Numerical reasoning test", "Verbal reasoning test"]);
    await expect(page.getByText("Tests are taken online.")).toBeVisible();

    // Sponsorship with its evidence note and a link into the real register search.
    await expect(page.getByTestId("sponsorship-badge").first()).toContainText("Sponsors");
    await expect(page.getByText("Stated on the graduate visa page.")).toBeVisible();
    await expect(page.getByRole("link", { name: "sponsor register" })).toHaveAttribute("href", "/visa-sponsors?q=E2EGS%20Alpha");

    // Apply link is external and safe; the source, source date and verification date are shown.
    const apply = page.getByTestId("apply-link");
    await expect(apply).toHaveAttribute("href", "https://example.com/e2e-apply");
    await expect(apply).toHaveAttribute("target", "_blank");
    await expect(apply).toHaveAttribute("rel", /noopener/);
    await expect(page.getByTestId("source")).toContainText("example.com");
    await expect(page.getByTestId("source")).toContainText("Source dated");
    await expect(page.getByTestId("source")).toContainText("Last verified");
    await expect(page.getByTestId("stale-warning")).toHaveCount(0);

    // Related schemes in the same sector are real schemes only (none share this sector, so no block).
    await expect(page.getByRole("heading", { name: /^More in/ })).toHaveCount(0);
  });

  test("closed, upcoming and undated schemes say so and never offer a stale apply button", async ({ page }) => {
    await page.goto(`${LIST}/e2egs-gamma`);
    await expect(page.getByTestId("application-status")).toHaveText("Closed");
    await expect(page.getByTestId("timeline")).toContainText("Closed 5 days ago");
    await expect(page.getByTestId("apply-link")).toHaveCount(0);

    await page.goto(`${LIST}/e2egs-delta`);
    await expect(page.getByTestId("application-status")).toHaveText("Opening soon");
    await expect(page.getByTestId("timeline")).toContainText("Opens in 30 days");

    await page.goto(`${LIST}/e2egs-epsilon`);
    await expect(page.getByTestId("application-status")).toHaveText("Dates not published");
    await expect(page.getByTestId("dates")).toContainText("Not published");
    await expect(page.getByTestId("stale-warning")).toBeVisible();
    await expect(page.getByText("Not published by the employer").first()).toBeVisible();

    await page.goto(`${LIST}/e2egs-beta`);
    await expect(page.getByTestId("timeline")).toContainText("Rolling");
    await expect(page.getByTestId("dates")).toContainText("None — rolling");
  });

  test("drafts and unknown slugs are 404 and out of the index", async ({ page }) => {
    for (const slug of ["e2egs-draft", "no-such-scheme"]) {
      const response = await page.goto(`${LIST}/${slug}`);
      expect(response?.status()).toBe(404);
      await expect(page.locator("body")).not.toContainText("Unpublished Programme");
    }
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/graduate-schemes/e2egs-alpha");
    expect(sitemap).not.toContain("e2egs-draft");
  });

  test("SEO: titles, canonical, robots and structured data", async ({ page }) => {
    await page.goto(`${LIST}/e2egs-alpha`);
    await expect(page).toHaveTitle(/Engineering Graduate Programme — E2EGS Alpha \| JobPilot AI/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /two-year rotational programme/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/graduate-schemes\/e2egs-alpha$/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const lds = await page.locator('script[type="application/ld+json"]').allTextContents();
    const parsed = lds.map((text) => JSON.parse(text));
    expect(parsed.some((ld) => ld["@type"] === "BreadcrumbList" && ld.itemListElement.length === 3)).toBe(true);
    const webpage = parsed.find((ld) => ld["@type"] === "WebPage");
    expect(webpage.name).toContain("E2EGS Alpha");
    expect(webpage.dateModified).toBeTruthy();

    // A description is built only from real fields when there's no written one.
    await page.goto(`${LIST}/e2egs-delta`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Consulting Analyst at E2EGS Delta.*Opens in 30 days.*Visa sponsorship: some tracks/);

    await page.goto(`${LIST}/no-such-scheme`);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);

    await page.goto(`${LIST}?q=e2egs`);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/); // a filtered view
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/graduate-schemes$/);
    const list = JSON.parse((await page.locator('script[type="application/ld+json"]').allTextContents()).find((t) => t.includes("ItemList"))!);
    expect(list.itemListElement).toHaveLength(5);
    expect(list.itemListElement[0].url).toMatch(/\/graduate-schemes\/e2egs-alpha$/);

    await page.goto(LIST);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0); // the main list is indexable
  });

  test("pagination", async ({ page }) => {
    const extra = Array.from({ length: 13 }, (_, i) => base({ slug: `e2egs-page-${i}`, employer: `E2EGSPAGE ${String(i).padStart(2, "0")}`, scheme_name: `Paged ${i}`, is_rolling: true }));
    await db().from("graduate_schemes").insert(extra);
    try {
      await page.goto(`${LIST}?q=e2egspage&sort=employer`);
      await expect(cards(page)).toHaveCount(12);
      await expect(page.getByTestId("result-count")).toContainText("13 schemes");
      await expect(page.getByTestId("result-count")).toContainText("page 1 of 2");
      await page.getByRole("link", { name: "2", exact: true }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(cards(page)).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    } finally {
      await db().from("graduate_schemes").delete().like("slug", "e2egs-page-%");
    }
  });

  test("works at phone width with no horizontal scroll", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 375, height: 760 } });
    const page = await context.newPage();
    try {
      for (const url of [`${LIST}?q=e2egs`, `${LIST}/e2egs-alpha`]) {
        await page.goto(url);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      }
    } finally {
      await context.close();
    }
  });

  test("the sponsorship page links to the same schemes and the site navigation lists the new page", async ({ page }) => {
    await page.goto("/graduate-visa-sponsorship");
    await expect(page.getByRole("link", { name: "Browse all graduate schemes" })).toBeVisible();
    await expect(page.getByText("Mystery Programme")).toBeVisible();
    await expect(page.getByText("Unpublished Programme")).toHaveCount(0);
    await page.getByLabel("Scheme or employer").fill("E2EGS Alpha");
    await page.getByRole("button", { name: /Details & source evidence/ }).first().click();
    await page.getByRole("link", { name: "Full details, dates and assessments" }).click();
    await expect(page).toHaveURL(/\/graduate-schemes\/e2egs-alpha$/);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Graduate Schemes", exact: true })).toBeVisible();
  });
});

// ---- data protection --------------------------------------------------------------------------------------------------

test.describe("access control", () => {
  test.beforeAll(async () => {
    await cleanup();
    await db().from("graduate_schemes").insert(SEEDS);
  });

  test("anonymous and ordinary users can read published schemes but never drafts, and cannot write", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: visible } = await anon.from("graduate_schemes").select("slug").like("slug", "e2egs-%");
    expect(visible!.map((row) => row.slug).sort()).toEqual(["e2egs-alpha", "e2egs-beta", "e2egs-delta", "e2egs-epsilon", "e2egs-gamma"]);

    const insert = await anon.from("graduate_schemes").insert(base({ slug: "e2egs-forged", employer: "E2EGS Forged", scheme_name: "Forged" }));
    expect(insert.error).not.toBeNull();
    await anon.from("graduate_schemes").update({ scheme_name: "Hacked" }).eq("slug", "e2egs-alpha");
    await anon.from("graduate_schemes").delete().eq("slug", "e2egs-alpha");
    const { data: alpha } = await db().from("graduate_schemes").select("scheme_name").eq("slug", "e2egs-alpha").single();
    expect(alpha!.scheme_name).toBe("Engineering Graduate Programme");

    const user = await createIsolatedUser({ fullName: "Plain GS User" });
    try {
      const signedIn = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      await signedIn.auth.signInWithPassword({ email: user.email, password: user.password });
      const forged = await signedIn.from("graduate_schemes").insert(base({ slug: "e2egs-forged2", employer: "E2EGS Forged2", scheme_name: "Forged2" }));
      expect(forged.error).not.toBeNull();
      const { data: drafts } = await signedIn.from("graduate_schemes").select("slug").eq("slug", "e2egs-draft");
      expect(drafts).toHaveLength(0);
    } finally {
      await deleteIsolatedUser(user.id);
    }
  });

  test("the database refuses impossible rows", async () => {
    const bad = [
      base({ slug: "e2egs-bad-1", employer: "E2EGS Bad", scheme_name: "1", opens_on: "2026-05-01", deadline_on: "2026-04-01" }),
      base({ slug: "e2egs-bad-2", employer: "E2EGS Bad", scheme_name: "2", source_url: "javascript:alert(1)" }),
      base({ slug: "e2egs-bad-3", employer: "E2EGS Bad", scheme_name: "3", application_url: "ftp://x" }),
      base({ slug: "e2egs-bad-4", employer: "E2EGS Bad", scheme_name: "4", assessments: ["magic"] }),
      base({ slug: "E2EGS Bad Slug", employer: "E2EGS Bad", scheme_name: "5" }),
      base({ slug: "e2egs-alpha", employer: "E2EGS Bad", scheme_name: "6" }),
      base({ slug: "e2egs-bad-7", employer: "E2EGS Bad", scheme_name: "7", salary_min: 50000, salary_max: 40000 }),
    ];
    for (const row of bad) expect((await db().from("graduate_schemes").insert(row)).error, String(row.slug)).not.toBeNull();
  });
});

// ---- admin ----------------------------------------------------------------------------------------------------------

test.describe("admin", () => {
  test.beforeAll(cleanup);

  test("a staff account without the permission is turned away from every admin page", async ({ browser }) => {
    const user = await createIsolatedUser({ fullName: "Limited GS Admin" });
    await markOnboarded(user.id);
    await db().from("profiles").update({ role: "admin" }).eq("id", user.id);
    const { data: role } = await db().from("admin_roles").insert({ slug: `e2e-gs-limited-${Date.now()}`, name: "E2E limited", permissions: ["manage_users"] }).select("id").single();
    await db().from("admin_user_roles").insert({ user_id: user.id, admin_role_id: role!.id });
    const { context, page } = await loginContext(browser, user);
    try {
      await page.waitForURL(/\/admin/);
      for (const url of ["/admin/graduate-schemes", "/admin/graduate-schemes/new", "/admin/graduate-schemes/import"]) {
        await page.goto(url);
        await expect(page).toHaveURL(/\/admin$/);
      }
    } finally {
      await context.close();
      await deleteIsolatedUser(user.id);
      await db().from("admin_roles").delete().eq("id", role!.id);
    }
  });

  test("create, validate, edit, unpublish, publish, import and delete", async ({ browser, page: publicPage }) => {
    test.setTimeout(300_000);
    const admin = await createIsolatedUser({ fullName: "GS Super Admin" });
    await makeSuperAdmin(admin.id);
    const { context, page } = await loginContext(browser, admin);
    const row = async (slug: string) => (await db().from("graduate_schemes").select("*").eq("slug", slug).maybeSingle()).data;
    try {
      await page.waitForURL(/\/admin/);
      await dismissBanner(page);

      // ---- create with every field ----
      await page.goto("/admin/graduate-schemes");
      await expect(page.getByTestId("admin-scheme-row")).toHaveCount(0);
      await page.getByRole("link", { name: "Add scheme" }).click();
      await page.getByLabel("Employer", { exact: true }).fill("E2EGS Admin Co");
      await page.getByLabel("Programme name").fill("Data & Analytics Programme");
      await selectOption(page, "Sector", "Technology");
      await selectOption(page, "Sponsorship status", "Some tracks");
      await page.getByLabel("Description (optional)").fill("Created by the admin form.");
      await page.getByLabel("Salary as published (optional)").fill("£34,000");
      await page.getByLabel("Minimum salary, £ (optional)").fill("34000");
      await page.getByLabel("Maximum salary, £ (optional)").fill("36,000");
      await page.getByLabel("Locations (optional)").fill("Bristol, Cardiff, Bristol");
      await page.getByLabel("Final-year students").check();
      await page.getByLabel("Recent graduates").check();
      await page.getByLabel("Opening date (optional)").fill(ukToday(-5));
      await page.getByLabel("Deadline (optional)").fill(ukToday(45));
      await page.getByLabel("Rolling applications").check();
      await page.getByLabel("Assessment notes (optional)").fill("Video interview is recorded.");
      await page.getByLabel("Application link (optional)").fill("https://example.com/e2e-admin-apply");
      await page.getByLabel("Notes on the evidence (optional)").fill("Only some streams sponsor.");
      await page.getByLabel("Source URL").fill("https://example.com/e2e-admin-source");
      await page.getByLabel("Source date").fill(ukToday(-30));
      await page.getByLabel("Verified date").fill(ukToday(-1));
      await page.getByRole("button", { name: "Create scheme" }).click();
      await page.waitForURL(/\/admin\/graduate-schemes$/);
      await expect(page.getByTestId("admin-scheme-row")).toHaveCount(1);

      let created = await row("e2egs-admin-co-data-and-analytics-programme");
      expect(created).toMatchObject({
        employer: "E2EGS Admin Co", scheme_name: "Data & Analytics Programme", sector: "technology", sponsorship_status: "some_tracks",
        salary: "£34,000", salary_min: 34000, salary_max: 36000, locations: ["Bristol", "Cardiff"], is_rolling: true, is_published: true,
        opens_on: ukToday(-5), deadline_on: ukToday(45),
        application_url: "https://example.com/e2e-admin-apply", source_url: "https://example.com/e2e-admin-source",
      });
      expect([...created!.study_stages].sort()).toEqual(["final_year", "graduate"]);

      // It is on the public site straight away.
      await publicPage.goto("/graduate-schemes/e2egs-admin-co-data-and-analytics-programme");
      await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText("Data & Analytics Programme");
      await expect(publicPage.getByTestId("timeline")).toContainText("Closes in 45 days (rolling");

      // ---- validation is enforced by the server, with clear messages ----
      const attempt = async (fill: () => Promise<void>, message: RegExp) => {
        await page.goto("/admin/graduate-schemes/new");
        await page.getByLabel("Employer", { exact: true }).fill("E2EGS Invalid");
        await page.getByLabel("Programme name").fill(`Invalid ${Math.random()}`);
        await page.getByLabel("Source URL").fill("https://example.com/s");
        await page.getByLabel("Source date").fill(ukToday(-30));
        await page.getByLabel("Verified date").fill(ukToday(-1));
        await fill();
        await page.getByRole("button", { name: "Create scheme" }).click();
        await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
        await expect(page).toHaveURL(/\/graduate-schemes\/new/);
      };
      await attempt(async () => {
        await page.getByLabel("Verified date").fill(ukToday(5));
      }, /can't be in the future/);
      await attempt(async () => {
        await page.getByLabel("Opening date (optional)").fill(ukToday(10));
        await page.getByLabel("Deadline (optional)").fill(ukToday(2));
      }, /deadline can't be before the opening date/);
      await attempt(async () => {
        await page.getByLabel("Application link (optional)").fill("javascript:alert(1)");
      }, /valid application link/);
      await attempt(async () => {
        await page.getByLabel("Minimum salary, £ (optional)").fill("50000");
        await page.getByLabel("Maximum salary, £ (optional)").fill("40000");
      }, /maximum salary can't be lower/);
      await attempt(async () => {
        await page.getByLabel("URL slug (optional)").fill("Bad Slug!");
      }, /URL slug can only use/);
      await attempt(async () => {
        await page.getByLabel("Employer", { exact: true }).fill("E2EGS Admin Co");
        await page.getByLabel("Programme name").fill("Data & Analytics Programme");
      }, /already exists/);
      expect((await db().from("graduate_schemes").select("id", { count: "exact", head: true }).eq("employer", "E2EGS Invalid")).count).toBe(0);

      // ---- edit keeps the slug, changes the page ----
      await page.goto("/admin/graduate-schemes");
      await page.getByRole("link", { name: "Edit Data & Analytics Programme" }).click();
      await page.getByLabel("Description (optional)").fill("Edited description.");
      await page.getByLabel("Deadline (optional)").fill("");
      await page.getByLabel("Rolling applications").uncheck();
      await page.getByRole("button", { name: "Save changes" }).click();
      await page.waitForURL(/\/admin\/graduate-schemes$/);
      created = await row("e2egs-admin-co-data-and-analytics-programme");
      expect(created).toMatchObject({ description: "Edited description.", deadline_on: null, is_rolling: false });
      await publicPage.goto("/graduate-schemes/e2egs-admin-co-data-and-analytics-programme");
      await expect(publicPage.getByTestId("description")).toHaveText("Edited description.");
      await expect(publicPage.getByTestId("dates")).toContainText("Not published"); // blank deadline is shown as unpublished, not invented

      // ---- unpublish hides it everywhere; publish restores it ----
      await page.getByRole("button", { name: "Unpublish Data & Analytics Programme" }).click();
      await expect(page.getByTestId("admin-scheme-row")).toContainText("Draft");
      expect((await publicPage.goto("/graduate-schemes/e2egs-admin-co-data-and-analytics-programme"))?.status()).toBe(404);
      await publicPage.goto("/graduate-schemes?q=e2egs+admin");
      await expect(cards(publicPage)).toHaveCount(0);
      await page.getByRole("button", { name: "Publish Data & Analytics Programme" }).click();
      await expect(page.getByTestId("admin-scheme-row")).not.toContainText("Draft");
      expect((await publicPage.goto("/graduate-schemes/e2egs-admin-co-data-and-analytics-programme"))?.status()).toBe(200);

      // ---- CSV import: check (nothing saved), then import; a re-import updates in place without blanking ----
      await page.goto("/admin/graduate-schemes/import");
      const header = "employer,scheme_name,sector,salary,locations,sponsorship_status,notes,source_url,source_date,verified_at,study_stages,opens_on,deadline_on,rolling,application_url,salary_min,salary_max,published";
      const src = `https://example.com/e2e-csv,${ukToday(-20)},${ukToday(-2)}`;
      const csv = [
        header,
        `E2EGS CSV One,Graduate Programme One,Technology,"£30,000",London; Leeds,sponsors,,${src},final_year; postgraduate,${ukToday(-3)},${ukToday(15)},no,https://example.com/e2e-csv-apply,30000,32000,yes`,
        `E2EGS CSV Two,Programme Two,Law,,,no,,${src},,,,yes,,,,no`,
        `E2EGS CSV Bad Sector,Programme Three,Astrology,,,no,,${src},,,,,,,,,`,
        `E2EGS CSV Bad Date,Programme Four,Law,,,no,,https://example.com/x,${ukToday(-20)},${ukToday(-2)},,${ukToday(9)},${ukToday(3)},,,,,,`,
        `E2EGS CSV One,Graduate Programme One,Technology,"£30,000",London,sponsors,,${src},,,,,,,,,,`,
        `E2EGS CSV Bad Stage,Programme Six,Law,,,no,,${src},toddler,,,,,,,,,`,
      ].join("\n");
      await page.getByLabel("CSV data").fill(csv);
      await page.getByRole("button", { name: "Check (nothing is saved)" }).click();
      const result = page.getByTestId("import-result");
      await expect(result).toContainText("Would create 2");
      await expect(result).toContainText("4 skipped");
      await expect(result).toContainText('Row 4: Unrecognised sector "Astrology"');
      await expect(result).toContainText("Row 5: The deadline can't be before the opening date");
      await expect(result).toContainText("Row 6: Duplicate of an earlier row");
      await expect(result).toContainText('Row 7: Unrecognised study stage "toddler"');
      expect((await db().from("graduate_schemes").select("id", { count: "exact", head: true }).like("employer", "E2EGS CSV%")).count).toBe(0);

      await page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(result).toContainText("Created 2, updated 0");
      const one = await row("e2egs-csv-one-graduate-programme-one");
      expect(one).toMatchObject({ sector: "technology", sponsorship_status: "sponsors", locations: ["London", "Leeds"], is_rolling: false, salary_min: 30000, salary_max: 32000, opens_on: ukToday(-3), deadline_on: ukToday(15), is_published: true });
      expect([...one!.study_stages].sort()).toEqual(["final_year", "postgraduate"]);
      const two = await row("e2egs-csv-two-programme-two");
      expect(two).toMatchObject({ is_rolling: true, is_published: false });
      expect((await publicPage.goto("/graduate-schemes/e2egs-csv-two-programme-two"))?.status()).toBe(404);
      expect((await publicPage.goto("/graduate-schemes/e2egs-csv-one-graduate-programme-one"))?.status()).toBe(200);

      // Re-import a short file (required columns only) with a changed salary: updates in place, blanks nothing it didn't mention.
      const short = `employer,scheme_name,sector,salary,locations,sponsorship_status,notes,source_url,source_date,verified_at\nE2EGS CSV One,Graduate Programme One,Technology,"£31,000",London,sponsors,,${src}`;
      await page.getByLabel("CSV data").fill(short);
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(result).toContainText("Created 0, updated 1");
      const updated = await row("e2egs-csv-one-graduate-programme-one");
      expect(updated).toMatchObject({ id: one!.id, salary: "£31,000", deadline_on: ukToday(15), salary_min: 30000, application_url: "https://example.com/e2e-csv-apply" });
      expect((await db().from("graduate_schemes").select("id", { count: "exact", head: true }).like("employer", "E2EGS CSV One")).count).toBe(1);

      // Unknown column names are refused rather than silently ignored.
      await page.getByLabel("CSV data").fill(`${short.split("\n")[0]},deadlin\n${short.split("\n")[1]},x`);
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Unknown column" })).toBeVisible();

      // ---- delete ----
      await page.goto("/admin/graduate-schemes");
      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByRole("button", { name: "Delete Data & Analytics Programme" }).click();
      await expect(page.getByTestId("admin-scheme-row").filter({ hasText: "Data & Analytics Programme" })).toHaveCount(0);
      expect(await row("e2egs-admin-co-data-and-analytics-programme")).toBeNull();

      // ---- every change was audit-logged with who did it ----
      const { data: audit } = await db().from("admin_audit_logs").select("action").eq("actor_id", admin.id).eq("entity_type", "graduate_scheme");
      const actions = new Set(audit!.map((entry) => entry.action));
      for (const action of ["graduate_scheme.create", "graduate_scheme.update", "graduate_scheme.unpublish", "graduate_scheme.publish", "graduate_scheme.import", "graduate_scheme.delete"]) {
        expect(actions.has(action), action).toBe(true);
      }
    } finally {
      await context.close();
      await deleteIsolatedUser(admin.id);
    }
  });
});
