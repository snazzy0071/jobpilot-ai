import { createClient } from "@supabase/supabase-js";
import { test, expect as baseExpect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { makeSuperAdmin, markOnboarded } from "../support/roles";

// The Advice Hub against the REAL database. The eight opening guides (migration 0115) are real content and are only read here;
// everything the tests add (slugs "e2eah-…") is created by them and deleted afterwards.

test.describe.configure({ mode: "serial" });
const expect = baseExpect.configure({ timeout: 30_000 });
test.beforeEach(() => {
  test.setTimeout(240_000);
});

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const HUB = "/advice-hub";

const SEED = {
  cv: "cv-checklist-before-you-apply",
  ats: "how-applicant-tracking-systems-read-your-cv",
  interviews: "prepare-for-a-competency-interview",
  applications: "keep-track-of-every-application",
  grad: "how-to-read-a-graduate-scheme-listing",
  visa: "sponsorship-basics-what-a-licence-means",
  assessments: "the-main-graduate-assessments-explained",
  career: "choosing-between-job-offers",
};

const block = (text: string) => ({ type: "paragraph", text });
const guide = (over: Record<string, unknown>) => ({
  title: "E2E Guide", summary: "An e2e guide.", category: "career_advice", content: [block("Body text.")], featured_rank: null, related_slugs: [], author_name: null, reviewed_on: null,
  published_at: new Date(Date.now() - 3600_000).toISOString(), ...over,
});

async function cleanup() {
  await db().from("advice_guides").delete().like("slug", "e2eah-%");
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

/** Navigates and clears the cookie banner, which is fixed to the bottom of the viewport and can cover controls near it. */
async function go(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
}

const cards = (page: Page) => page.getByTestId("guide-card");
const titles = (page: Page) => page.getByTestId("guide-list").locator('[data-testid="guide-title"]');

test.afterAll(cleanup);

test.describe("public hub", () => {
  test.beforeAll(async () => {
    await cleanup();
    const { error } = await db().from("advice_guides").insert([
      guide({ slug: "e2eah-draft", title: "E2E Secret Draft", published_at: null }),
      guide({ slug: "e2eah-scheduled", title: "E2E Scheduled Guide", published_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }),
      guide({ slug: "e2eah-live", title: "E2E Zebrastripe Live Guide", summary: "Contains the unusual word quokkacorn.", category: "assessments", published_at: new Date(Date.now() - 86_400_000).toISOString() }),
    ]);
    if (error) throw new Error(error.message);
    for (const path of [HUB, `${HUB}/${SEED.cv}`, "/sitemap.xml"]) await fetch(`${BASE_URL}${path}`).catch(() => undefined);
  });

  test("lists guides in eight categories with featured guides first, newest first below", async ({ page }) => {
    await go(page, HUB);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("your UK job search");
    const chips = page.getByTestId("category-chip");
    await expect(chips).toHaveCount(9); // All + the eight categories
    await expect(chips).toContainText(["All guides", "CV", "ATS", "Interviews", "Applications", "Graduate Schemes", "Visa & Sponsorship", "Assessments", "Career Advice"]);

    const featured = page.getByTestId("featured").getByTestId("featured-card").locator('[data-testid="guide-title"]');
    await expect(featured).toHaveText(["A CV checklist to run before every application", "How applicant tracking systems read your CV", "How to read a graduate scheme listing"]);

    // Every real category has at least one guide; each seeded guide is listed; drafts and scheduled ones are not.
    const list = await titles(page).allTextContents();
    for (const expected of ["A CV checklist to run before every application", "Preparing for a competency interview with the STAR method", "Sponsorship basics: what a sponsor licence does and doesn't mean", "Choosing between job offers: a simple framework", "E2E Zebrastripe Live Guide"]) {
      expect(list).toContain(expected);
    }
    expect(list).not.toContain("E2E Secret Draft");
    expect(list).not.toContain("E2E Scheduled Guide");
    expect(list.indexOf("E2E Zebrastripe Live Guide")).toBeLessThan(list.indexOf("A CV checklist to run before every application")); // published most recently
    await expect(page.getByTestId("result-count")).toContainText(/\d+ guides/);
  });

  test("category filter: chips, heading, only that category, and it is a shareable URL", async ({ page }) => {
    await go(page, HUB);
    await page.getByTestId("category-chip").filter({ hasText: "Interviews" }).click();
    await expect(page).toHaveURL(/category=interviews/);
    await expect(page.getByTestId("category-heading")).toHaveText("Interviews");
    await expect(titles(page)).toHaveText(["Preparing for a competency interview with the STAR method"]);
    await expect(page.getByTestId("featured")).toHaveCount(0); // the featured row is for the unfiltered hub
    await expect(page.getByTestId("category-chip").filter({ hasText: "Interviews" })).toHaveAttribute("aria-current", "true");

    for (const [category, slug] of [["assessments", SEED.assessments], ["visa_sponsorship", SEED.visa], ["career_advice", SEED.career]] as const) {
      await go(page, `${HUB}?category=${category}`);
      const hrefs = await page.getByTestId("guide-list").getByRole("link").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
      expect(hrefs).toContain(`/advice-hub/${slug}`);
    }
    await go(page, `${HUB}?category=not-a-category`); // ignored, not trusted
    await expect(page.getByTestId("category-heading")).toHaveCount(0);
  });

  test("search: every word must match, titles rank first, results keep the category, junk is safe", async ({ page }) => {
    await go(page, HUB);
    await page.getByLabel("Search the guides").fill("star method");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/q=star\+method|q=star%20method/);
    await expect(titles(page)).toHaveText(["Preparing for a competency interview with the STAR method"]);
    await expect(page.getByTestId("result-count")).toContainText("1 guide matching “star method”");
    await expect(page.getByTestId("featured")).toHaveCount(0);

    // Body-only and summary-only matches are found too.
    await go(page, `${HUB}?q=quokkacorn`);
    await expect(titles(page)).toHaveText(["E2E Zebrastripe Live Guide"]);
    await go(page, `${HUB}?q=parser`);
    await expect(titles(page)).toHaveText(["How applicant tracking systems read your CV"]);

    // Ranking: a title hit beats a body hit.
    await go(page, `${HUB}?q=cv`);
    const ranked = await titles(page).allTextContents();
    const titleHits = ranked.map((t) => /(^|\s)cv(\s|$)/i.test(t));
    expect(titleHits[0]).toBe(true);
    expect(titleHits).toEqual([...titleHits].sort((a, b) => Number(b) - Number(a))); // every title match comes before any body-only match
    expect(ranked.length).toBeGreaterThan(2);

    // Category + search together; the form keeps the category.
    await go(page, `${HUB}?category=ats&q=keywords`);
    await expect(titles(page)).toHaveText(["How applicant tracking systems read your CV"]);
    await expect(page.locator('form[role="search"] input[name="category"]')).toHaveValue("ats");

    // Nothing found (and drafts are not searchable).
    for (const q of ["zzzznothing", "Secret Draft"]) {
      await go(page, `${HUB}?q=${encodeURIComponent(q)}`);
      await expect(page.getByTestId("hub-no-results")).toBeVisible();
    }
    await go(page, `${HUB}?q=${encodeURIComponent("<script>alert(1)</script>")}`);
    await expect(page.getByTestId("hub-no-results")).toBeVisible();
    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(page).toHaveURL(/\/advice-hub$/);
  });

  test("search works without JavaScript (a plain form)", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await go(page, HUB);
      await page.getByLabel("Search the guides").fill("sponsor licence");
      await page.getByRole("button", { name: "Search" }).click();
      await expect(page).toHaveURL(/q=sponsor\+licence|q=sponsor%20licence/);
      await expect(titles(page).first()).toContainText("Sponsorship basics");
    } finally {
      await context.close();
    }
  });

  test("a guide page: heading, byline facts, table of contents, body, related guides and a next step", async ({ page }) => {
    await go(page, `${HUB}/${SEED.cv}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A CV checklist to run before every application");
    await expect(page.getByTestId("reading-time")).toContainText("min read");
    await expect(page.getByTestId("guide-author")).toHaveText("JobPilot AI editorial team");
    await expect(page.getByTestId("reviewed")).toContainText("Last reviewed");
    await expect(page.getByRole("link", { name: "CV", exact: true }).first()).toHaveAttribute("href", "/advice-hub?category=cv");

    // TOC: one link per heading, pointing at a real anchor; clicking it goes there.
    const toc = page.getByTestId("toc").getByRole("link");
    const headings = await page.getByTestId("article").locator("h2").evaluateAll((els) => els.map((el) => ({ id: el.id, text: el.textContent })));
    expect(headings.length).toBeGreaterThanOrEqual(4);
    await expect(toc).toHaveCount(headings.length);
    expect(await toc.evaluateAll((links) => links.map((a) => a.getAttribute("href")))).toEqual(headings.map((h) => `#${h.id}`));
    await expect(toc).toHaveText(headings.map((h) => h.text!));
    await toc.nth(2).click();
    await expect(page).toHaveURL(new RegExp(`#${headings[2].id}$`));
    await expect(page.locator(`#${headings[2].id}`)).toBeInViewport();

    // Body: real list and paragraphs from the typed blocks.
    await expect(page.getByTestId("article").locator("ul li").first()).toBeVisible();

    // Related: hand-picked first (ATS, then tracker), never itself, never a draft.
    const related = page.getByTestId("related").locator('[data-testid="guide-title"]');
    await expect(related).toHaveCount(3); // the two hand-picked, topped up from what is live
    await expect(related.nth(0)).toHaveText("How applicant tracking systems read your CV");
    await expect(related.nth(1)).toHaveText("How to keep track of every application");
    const relatedTitles = await related.allTextContents();
    expect(relatedTitles).not.toContain("A CV checklist to run before every application");
    expect(relatedTitles.join(" ")).not.toMatch(/Secret Draft|Scheduled Guide/);
    await expect(page.getByTestId("related").getByRole("link").first()).toHaveAttribute("href", `/advice-hub/${SEED.ats}`);

    // Next step: the tool for the category, from one config.
    await expect(page.getByTestId("next-step").getByRole("link", { name: "Open CV Builder" })).toHaveAttribute("href", "/features/cv");
    await go(page, `${HUB}/${SEED.visa}`);
    await expect(page.getByTestId("next-step").getByRole("link")).toHaveAttribute("href", "/visa-sponsors");
    await expect(page.getByTestId("article")).toContainText("not immigration advice");
  });

  test("drafts, scheduled and unknown guides are 404 and never leak", async ({ page }) => {
    for (const slug of ["e2eah-draft", "e2eah-scheduled", "no-such-guide"]) {
      expect((await page.goto(`${HUB}/${slug}`))?.status(), slug).toBe(404);
      await expect(page.locator("body")).not.toContainText("Secret Draft");
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    }
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/advice-hub/${SEED.cv}`);
    expect(sitemap).toContain("/advice-hub/e2eah-live");
    expect(sitemap).not.toContain("e2eah-draft");
    expect(sitemap).not.toContain("e2eah-scheduled");
    expect(sitemap).toMatch(/\/advice-hub</);
  });

  test("SEO: titles, descriptions, canonical, robots, structured data", async ({ page }) => {
    await go(page, HUB);
    await expect(page).toHaveTitle(/Advice Hub \| JobPilot AI/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/advice-hub$/);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const list = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t)).find((ld) => ld["@type"] === "ItemList");
    expect(list.itemListElement.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(list)).not.toContain("e2eah-draft");

    await go(page, `${HUB}?q=cv`);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/advice-hub$/);

    await go(page, `${HUB}/${SEED.ats}`);
    await expect(page).toHaveTitle(/How applicant tracking systems read your CV \| JobPilot AI/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /What an ATS does with your CV/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/advice-hub/${SEED.ats}$`));
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "article");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    const lds = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((t) => JSON.parse(t));
    const article = lds.find((ld) => ld["@type"] === "Article");
    expect(article).toMatchObject({ headline: "How applicant tracking systems read your CV", articleSection: "ATS" });
    expect(article.datePublished).toBeTruthy();
    const crumbs = lds.find((ld) => ld["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual(["Home", "Advice Hub", "ATS", "How applicant tracking systems read your CV"]);
  });

  test("pagination", async ({ page }) => {
    const many = Array.from({ length: 13 }, (_, i) => guide({ slug: `e2eah-page-${i}`, title: `E2E Paged ${String(i).padStart(2, "0")}`, summary: "paginationmarker" }));
    await db().from("advice_guides").insert(many);
    try {
      await go(page, `${HUB}?q=paginationmarker`);
      await expect(cards(page)).toHaveCount(12);
      await expect(page.getByTestId("result-count")).toContainText("13 guides");
      await expect(page.getByTestId("result-count")).toContainText("page 1 of 2");
      await page.getByRole("link", { name: "2", exact: true }).click();
      await expect(page).toHaveURL(/page=2/);
      await expect(cards(page)).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    } finally {
      await db().from("advice_guides").delete().like("slug", "e2eah-page-%");
    }
  });

  test("Blog stays separate: its own pages and content, and the hub links to it, not into it", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("visa advice");
    await expect(page.locator("body")).not.toContainText("A CV checklist to run before every application");
    await go(page, HUB);
    await expect(page.locator("body")).not.toContainText("How to format a CV for the UK job market"); // a blog post
    await expect(page.getByRole("link", { name: "Read the blog" })).toHaveAttribute("href", "/blog");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Advice Hub", exact: true })).toBeVisible();
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Blog", exact: true })).toBeVisible();
    // Different tables: nothing is shared.
    const { data: blogSlugs } = await db().from("blog_posts").select("slug");
    const { data: adviceSlugs } = await db().from("advice_guides").select("slug");
    const blog = new Set((blogSlugs ?? []).map((r) => r.slug));
    expect((adviceSlugs ?? []).filter((r) => blog.has(r.slug))).toEqual([]);
  });

  test("works at phone width with no horizontal scroll", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 375, height: 760 } });
    const page = await context.newPage();
    try {
      for (const url of [HUB, `${HUB}?category=cv`, `${HUB}/${SEED.cv}`]) {
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
  test("anonymous and ordinary users read live guides only and cannot write", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: visible } = await anon.from("advice_guides").select("slug").like("slug", "e2eah-%");
    expect((visible ?? []).map((r) => r.slug)).toEqual(["e2eah-live"]);

    expect((await anon.from("advice_guides").insert({ slug: "e2eah-forged", title: "x", summary: "x", category: "cv", content: [block("x")] })).error).not.toBeNull();
    await anon.from("advice_guides").update({ title: "hacked" }).eq("slug", SEED.cv);
    await anon.from("advice_guides").delete().eq("slug", SEED.cv);
    const { data: still } = await db().from("advice_guides").select("title").eq("slug", SEED.cv).single();
    expect(still!.title).toBe("A CV checklist to run before every application");

    const user = await createIsolatedUser({ fullName: "Plain Advice User" });
    try {
      const signedIn = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      await signedIn.auth.signInWithPassword({ email: user.email, password: user.password });
      expect((await signedIn.from("advice_guides").insert({ slug: "e2eah-forged2", title: "x", summary: "x", category: "cv", content: [block("x")] })).error).not.toBeNull();
      const { data: drafts } = await signedIn.from("advice_guides").select("slug").eq("slug", "e2eah-draft");
      expect(drafts).toHaveLength(0);
    } finally {
      await deleteIsolatedUser(user.id);
    }
  });

  test("the database refuses impossible guides", async () => {
    const good = { slug: "e2eah-bad", title: "T", summary: "S", category: "cv", content: [block("x")] };
    const bad = [
      { ...good, category: "blog" },
      { ...good, slug: "Bad Slug" },
      { ...good, content: [] },
      { ...good, content: { not: "an array" } },
      { ...good, featured_rank: 0 },
      { ...good, slug: SEED.cv },
      { ...good, related_slugs: ["a", "b", "c", "d", "e", "f", "g"] },
    ];
    for (const row of bad) expect((await db().from("advice_guides").insert(row as never)).error, JSON.stringify(row).slice(0, 60)).not.toBeNull();
  });
});

test.describe("admin", () => {
  test.beforeAll(cleanup);

  test("the Advice Hub and the Blog have separate permissions", async ({ browser }) => {
    const user = await createIsolatedUser({ fullName: "Blog-only Admin" });
    await markOnboarded(user.id);
    await db().from("profiles").update({ role: "admin" }).eq("id", user.id);
    const { data: role } = await db().from("admin_roles").insert({ slug: `e2e-ah-blog-${Date.now()}`, name: "E2E blog only", permissions: ["manage_blog"] }).select("id").single();
    await db().from("admin_user_roles").insert({ user_id: user.id, admin_role_id: role!.id });
    const { context, page } = await loginContext(browser, user);
    try {
      await page.waitForURL(/\/admin/);
      for (const url of ["/admin/advice-hub", "/admin/advice-hub/new"]) {
        await page.goto(url);
        await expect(page).toHaveURL(/\/admin$/);
      }
      await page.goto("/admin/blog");
      await expect(page).toHaveURL(/\/admin\/blog$/); // the blog permission still opens the blog
      await expect(page.getByRole("link", { name: "Advice Hub" })).toHaveCount(0);
    } finally {
      await context.close();
      await deleteIsolatedUser(user.id);
      await db().from("admin_roles").delete().eq("id", role!.id);
    }
  });

  test("create, edit, feature, schedule, publish, filter and delete guides — audited, and reflected publicly", async ({ browser, page: publicPage }) => {
    test.setTimeout(360_000);
    const admin = await createIsolatedUser({ fullName: "AH Super Admin" });
    await makeSuperAdmin(admin.id);
    const { context, page } = await loginContext(browser, admin);
    const row = async (slug: string) => (await db().from("advice_guides").select("*").eq("slug", slug).maybeSingle()).data;
    const adminRow = (title: string) => page.getByTestId("admin-guide-row").filter({ hasText: title });
    try {
      await page.waitForURL(/\/admin/);
      await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);

      // ---- list, filters ----
      await page.goto("/admin/advice-hub");
      await expect(page.getByRole("link", { name: "Advice Hub" }).first()).toBeVisible();
      expect(await page.getByTestId("admin-guide-row").count()).toBeGreaterThanOrEqual(8);
      await page.getByLabel("Category").selectOption("interviews");
      await expect(page.getByTestId("admin-guide-row")).toHaveCount(1);
      await page.getByLabel("Category").selectOption("");
      await page.getByLabel("Search").fill("licence");
      await expect(page.getByTestId("admin-guide-row")).toHaveCount(1);
      await page.getByLabel("Search").fill("");
      await expect(adminRow("A CV checklist")).toContainText("Featured #1");

      // ---- create: validation first ----
      await page.getByRole("link", { name: "New guide" }).click();
      await page.getByLabel("Title").fill("E2E Admin Guide");
      await page.getByLabel("Summary").fill("Created through the admin form.");
      await page.getByLabel("Category").selectOption("assessments");
      await page.getByLabel("URL slug (optional)").fill("Bad Slug!");
      await page.getByPlaceholder("Paragraph text").fill("First paragraph of the guide.");
      await page.getByRole("button", { name: "Create guide" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "lower-case letters" })).toBeVisible();
      await page.getByLabel("URL slug (optional)").fill("e2eah-admin-guide");
      await page.getByLabel("Related guides (optional)").fill("no-such-guide");
      await page.getByRole("button", { name: "Create guide" }).click();
      await expect(page.getByRole("alert").filter({ hasText: 'No guide has the slug "no-such-guide"' })).toBeVisible();
      await page.getByLabel("Related guides (optional)").fill(`${SEED.cv}, ${SEED.ats}`);
      await page.getByLabel("Last reviewed (optional)").fill("2099-01-01");
      await page.getByRole("button", { name: "Create guide" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "can't be in the future" })).toBeVisible();
      await page.getByLabel("Last reviewed (optional)").fill("2026-09-01");
      expect(await row("e2eah-admin-guide")).toBeNull(); // nothing saved by the failed attempts

      // headings (one with a blank id, two with the same text) + list
      await page.getByRole("button", { name: "Add heading" }).click();
      await page.getByPlaceholder("Heading text").last().fill("The first step");
      await page.getByRole("button", { name: "Add paragraph" }).click();
      await page.getByPlaceholder("Paragraph text").last().fill("Do the first thing.");
      await page.getByRole("button", { name: "Add heading" }).click();
      await page.getByPlaceholder("Heading text").last().fill("The first step");
      await page.getByRole("button", { name: "Add list" }).click();
      await page.getByPlaceholder("List item").last().fill("An item");
      await page.getByLabel("Author (optional)").fill("Test Author");
      await page.getByLabel("Featured order (optional)").fill("2");
      await page.getByRole("button", { name: "Create guide" }).click();
      await page.waitForURL(/\/admin\/advice-hub$/);

      const created = await row("e2eah-admin-guide");
      expect(created).toMatchObject({ title: "E2E Admin Guide", category: "assessments", author_name: "Test Author", featured_rank: 2, reviewed_on: "2026-09-01", published_at: null, related_slugs: [SEED.cv, SEED.ats] });
      const ids = (created!.content as { type: string; id?: string }[]).filter((b) => b.type === "heading").map((b) => b.id);
      expect(ids).toEqual(["the-first-step", "the-first-step-2"]); // generated and unique -> the TOC works
      await expect(adminRow("E2E Admin Guide").getByTestId("status")).toHaveText("Draft");

      // a draft is invisible publicly
      expect((await publicPage.goto(`${HUB}/e2eah-admin-guide`))?.status()).toBe(404);

      // ---- publish now, and it appears publicly with TOC + related ----
      await adminRow("E2E Admin Guide").getByRole("button", { name: "Publish E2E Admin Guide" }).click();
      await expect(adminRow("E2E Admin Guide").getByTestId("status")).toHaveText("Published");
      expect((await row("e2eah-admin-guide"))!.published_at).not.toBeNull();
      await publicPage.goto(`${HUB}/e2eah-admin-guide`);
      await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText("E2E Admin Guide");
      await expect(publicPage.getByTestId("toc").getByRole("link")).toHaveText(["The first step", "The first step"]);
      await expect(publicPage.locator("#the-first-step")).toBeVisible();
      await expect(publicPage.locator("#the-first-step-2")).toBeVisible();
      await expect(publicPage.getByTestId("related").locator('[data-testid="guide-title"]').first()).toHaveText("A CV checklist to run before every application");
      await expect(publicPage.getByTestId("guide-author")).toHaveText("Test Author");
      await publicPage.goto(HUB);
      await expect(publicPage.getByTestId("featured").getByTestId("featured-card").locator('[data-testid="guide-title"]')).toHaveText(["A CV checklist to run before every application", "E2E Admin Guide", "How applicant tracking systems read your CV"].slice(0, 3));

      // ---- edit (slug kept when left blank), feature toggle, unpublish ----
      await adminRow("E2E Admin Guide").getByRole("link", { name: "Edit E2E Admin Guide" }).click();
      await page.getByLabel("Title").fill("E2E Admin Guide (edited)");
      await page.getByLabel("URL slug (optional)").fill("");
      await page.getByLabel("Featured order (optional)").fill("");
      await page.getByRole("button", { name: "Save guide" }).click();
      await page.waitForURL(/\/admin\/advice-hub$/);
      expect(await row("e2eah-admin-guide")).toMatchObject({ title: "E2E Admin Guide (edited)", featured_rank: null });
      await expect(adminRow("edited").getByTestId("featured-badge")).toHaveCount(0);
      await adminRow("edited").getByRole("button", { name: "Feature E2E Admin Guide (edited)" }).click();
      await expect(adminRow("edited").getByTestId("featured-badge")).toBeVisible();
      await adminRow("edited").getByRole("button", { name: "Remove E2E Admin Guide (edited) from featured" }).click();
      await expect(adminRow("edited").getByTestId("featured-badge")).toHaveCount(0);

      // ---- schedule (UK time) ----
      await adminRow("edited").getByRole("link", { name: "Edit E2E Admin Guide (edited)" }).click();
      await page.getByLabel("Publish at (UK time, optional)").fill("2099-07-01T10:00");
      await page.getByRole("button", { name: "Save guide" }).click();
      await page.waitForURL(/\/admin\/advice-hub$/);
      expect((await row("e2eah-admin-guide"))!.published_at).toBe("2099-07-01T09:00:00+00:00"); // 10:00 BST is 09:00 UTC
      await expect(adminRow("edited").getByTestId("status")).toHaveText("Scheduled");
      expect((await publicPage.goto(`${HUB}/e2eah-admin-guide`))?.status()).toBe(404);

      // status filter
      await page.getByLabel("Status").selectOption("scheduled");
      await expect(page.getByTestId("admin-guide-row")).toHaveCount(1);
      await page.getByLabel("Status").selectOption("");

      // move back to drafts, then delete
      await adminRow("edited").getByRole("button", { name: "Move E2E Admin Guide (edited) to drafts" }).click();
      await expect(adminRow("edited").getByTestId("status")).toHaveText("Draft");
      expect((await row("e2eah-admin-guide"))!.published_at).toBeNull();
      page.once("dialog", (dialog) => void dialog.accept());
      await adminRow("edited").getByRole("button", { name: "Delete E2E Admin Guide (edited)" }).click();
      await expect(adminRow("edited")).toHaveCount(0);
      expect(await row("e2eah-admin-guide")).toBeNull();

      // ---- audit ----
      const { data: audit } = await db().from("admin_audit_logs").select("action").eq("actor_id", admin.id).eq("entity_type", "advice_guide");
      const actions = new Set(audit!.map((entry) => entry.action));
      for (const action of ["advice_guide.create", "advice_guide.update", "advice_guide.publish", "advice_guide.unpublish", "advice_guide.feature", "advice_guide.unfeature", "advice_guide.delete"]) {
        expect(actions.has(action), action).toBe(true);
      }
    } finally {
      await context.close();
      await deleteIsolatedUser(admin.id);
    }
  });
});
