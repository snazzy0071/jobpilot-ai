import { expect, test, type Page } from "@playwright/test";

// Every public page, in a real browser: SEO basics (title, description, canonical, social image, one h1, valid JSON-LD, image alt text),
// no horizontal overflow on a phone or a desktop, no script errors, and the new visual layer behaving (sticky phone CTA, hover ring,
// reduced motion still showing everything). No account or database writes are involved.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const ROUTES = [
  "/", "/pricing", "/features/cv", "/features/ats", "/features/cover-letter", "/features/interview", "/features/tracker", "/features/linkedin",
  "/features/jobmatch", "/features/gradprep", "/free-ats-checker", "/visa-sponsors", "/visa-sponsors/cities", "/visa-sponsors/statistics",
  "/sponsor-licence-check", "/deadlines", "/graduate-schemes", "/graduate-visa-sponsorship", "/compare", "/go", "/blog", "/advice-hub",
  "/about", "/contact", "/newsletter", "/status", "/for-universities", "/demo", "/partners", "/privacy", "/terms", "/cookies", "/accessibility",
];

async function open(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "load" });
  expect(response?.status(), path).toBe(200);
  const reject = page.getByRole("button", { name: /reject non-essential/i });
  if (await reject.isVisible().catch(() => false)) await reject.click();
}

test.describe("SEO and structure on every public page", () => {
  test.setTimeout(240_000);

  test("each page has a title, description, canonical, social image, one h1, valid JSON-LD and alt text", async ({ page }) => {
    const problems: string[] = [];
    for (const path of ROUTES) {
      await open(page, path);
      const title = await page.title();
      if (!title || title.length > 75) problems.push(`${path}: title "${title}" (${title.length})`);
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      if (!description || description.length < 50 || description.length > 200) problems.push(`${path}: description length ${description?.length ?? 0}`);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      const expected = new URL(path, "https://x.test").pathname.replace(/\/$/, "");
      if (!canonical || new URL(canonical).pathname.replace(/\/$/, "") !== expected) problems.push(`${path}: canonical ${canonical}`);
      if ((await page.locator('meta[property="og:image"]').count()) === 0) problems.push(`${path}: no og:image`);
      const h1s = await page.locator("h1:visible").count();
      if (h1s !== 1) problems.push(`${path}: ${h1s} visible h1`);
      for (const raw of await page.locator('script[type="application/ld+json"]').allTextContents()) {
        try {
          JSON.parse(raw);
        } catch {
          problems.push(`${path}: invalid JSON-LD`);
        }
      }
      const missingAlt = await page.locator("img:not([alt])").count();
      if (missingAlt > 0) problems.push(`${path}: ${missingAlt} img without alt`);
      if ((await page.locator("html").getAttribute("lang")) === null) problems.push(`${path}: no lang`);
    }
    expect(problems).toEqual([]);
  });

  test("structured data matches what the pages show", async ({ page }) => {
    const graph = async (path: string) => {
      await open(page, path);
      const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((raw) => JSON.parse(raw));
      return blocks.flatMap((block) => (Array.isArray(block) ? block : block["@graph"] ?? [block]));
    };
    const types = (nodes: { "@type"?: string }[]) => nodes.map((node) => node["@type"]);

    const home = await graph("/");
    expect(types(home)).toEqual(expect.arrayContaining(["Organization", "WebSite", "WebApplication", "FAQPage"]));

    const feature = await graph("/features/ats");
    expect(types(feature)).toEqual(expect.arrayContaining(["WebApplication", "BreadcrumbList", "FAQPage"]));
    const app = feature.find((node) => node["@type"] === "WebApplication");
    expect(app.featureList.length).toBeGreaterThan(2);

    const pricing = await graph("/pricing");
    const product = pricing.find((node) => node["@type"] === "Product");
    expect(product.offers.map((offer: { name: string; price: string }) => [offer.name, offer.price])).toEqual([["Free", "0"], ["Pro", "6"], ["Premium", "15"], ["Elite", "25"]]);
    expect(product.offers.slice(1).every((offer: { availability: string }) => offer.availability.endsWith("PreOrder"))).toBe(true);

    expect(types(await graph("/about"))).toContain("AboutPage");
    expect(types(await graph("/contact"))).toContain("ContactPage");
  });
});

test.describe("layout on phone and desktop", () => {
  test.setTimeout(240_000);

  for (const [name, viewport] of [["phone", { width: 390, height: 800 }], ["desktop", { width: 1360, height: 900 }]] as const) {
    test(`no horizontal overflow and no script errors on any page (${name})`, async ({ browser }) => {
      const context = await browser.newContext({ baseURL: BASE_URL, viewport });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const overflow: string[] = [];
      for (const path of ROUTES) {
        await open(page, path);
        // Scroll through so reveal animations run and lazy content mounts.
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < height; y += 700) {
          await page.evaluate((top) => window.scrollTo(0, top), y);
          await page.waitForTimeout(40);
        }
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (wide > 1) overflow.push(`${path} (+${wide}px)`);
      }
      expect(overflow).toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    });
  }
});

test.describe("the visual layer", () => {
  test("the sticky call to action appears on phones after scrolling, links to real pages, and is absent on forms and desktop", async ({ browser }) => {
    const phone = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 390, height: 800 } });
    const page = await phone.newPage();
    await open(page, "/features/cv");
    const bar = page.getByTestId("mobile-cta-bar");
    await expect(bar).toHaveAttribute("aria-hidden", "true");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(bar).toHaveAttribute("aria-hidden", "false");
    await expect(bar.getByRole("link", { name: /Get started/ })).toHaveAttribute("href", "/signup");
    await expect(bar.getByRole("link", { name: "Score my CV" })).toHaveAttribute("href", "/free-ats-checker");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(bar).toHaveAttribute("aria-hidden", "true");
    await open(page, "/contact");
    await expect(page.getByTestId("mobile-cta-bar")).toHaveCount(0);
    await phone.close();

    const desktop = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1360, height: 900 } });
    const wide = await desktop.newPage();
    await open(wide, "/features/cv");
    await wide.evaluate(() => window.scrollTo(0, 1500));
    await expect(wide.getByTestId("mobile-cta-bar")).toBeHidden();
    await desktop.close();
  });

  test("cards react on hover (gradient ring) and persona cards lead to real pages", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1360, height: 900 } });
    const page = await context.newPage();
    await open(page, "/");
    const card = page.getByRole("link", { name: /Search the sponsor register/ });
    await card.scrollIntoViewIfNeeded();
    const ring = () => card.evaluate((el) => Number(getComputedStyle(el, "::after").opacity));
    expect(await ring()).toBe(0);
    await card.hover();
    await expect.poll(ring).toBeGreaterThan(0.9);
    for (const [label, href] of [["Browse graduate schemes", "/graduate-schemes"], ["Search the sponsor register", "/visa-sponsors"], ["Score my CV free", "/free-ats-checker"], ["See institution plans", "/for-universities"]]) {
      await expect(page.getByRole("link", { name: new RegExp(label) }).first()).toHaveAttribute("href", href);
    }
    await context.close();
  });

  test("the dark stat band shows real figures", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1360, height: 900 } });
    const page = await context.newPage();
    await open(page, "/");
    const band = page.locator("section[aria-labelledby='stat-band-title']");
    await band.scrollIntoViewIfNeeded();
    await expect(band).toContainText("Licensed UK sponsors");
    await expect(band).toContainText("Aptitude test formats");
    await expect(band).toContainText("£0");
    await context.close();
  });

  test("with reduced motion the whole page is still readable (nothing stays hidden)", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1360, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await open(page, "/");
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 700) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(40);
    }
    for (const heading of ["Whatever stage of the search you", "Questions people ask first", "Ready to get started?"]) {
      await expect(page.getByRole("heading", { name: new RegExp(heading) })).toBeVisible();
    }
    await context.close();
  });
});
