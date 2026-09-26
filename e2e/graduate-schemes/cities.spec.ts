import { expect, test } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";

// Graduate schemes by city against the real database: the places come only from published schemes, spelling variants are one place, a
// draft never adds a place, unknown places are 404, and the sitemap lists exactly the places that exist. Rows are "e2ect-" slugs, deleted afterwards.

test.describe.configure({ mode: "serial" });

const db = () => getAdminClient();
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const CITY = `E2ECTCity${Date.now().toString(36)}`;
const CITY_SLUG = CITY.toLowerCase();
const HIDDEN = `E2ECTHidden${Date.now().toString(36)}`;

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const row = (over: Record<string, unknown>) => ({
  sector: "technology", is_rolling: true, is_published: true, study_stages: [], locations: [], sponsorship_status: "not_published",
  source_url: "https://example.com/e2e-source", source_date: day(-30), verified_at: day(-5), ...over,
});

test.beforeAll(async () => {
  await db().from("graduate_schemes").delete().like("slug", "e2ect-%");
  const { error } = await db().from("graduate_schemes").insert([
    row({ slug: "e2ect-one", employer: "E2ECT One", scheme_name: "Programme One", locations: [CITY, "Elsewhere"] }),
    row({ slug: "e2ect-two", employer: "E2ECT Two", scheme_name: "Programme Two", locations: [` ${CITY.toUpperCase()}`] }),
    row({ slug: "e2ect-draft", employer: "E2ECT Draft", scheme_name: "Draft Programme", locations: [HIDDEN], is_published: false }),
  ]);
  if (error) throw new Error(error.message);
});
test.afterAll(async () => {
  await db().from("graduate_schemes").delete().like("slug", "e2ect-%");
});

test("the index lists a place once with the number of published schemes that name it, and never a place only a draft names", async ({ page }) => {
  await page.goto("/graduate-schemes/cities");
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
  const card = page.getByTestId("city-list").getByRole("link", { name: new RegExp(CITY, "i") });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("2 schemes");
  await expect(page.getByText(HIDDEN)).toHaveCount(0);
  await expect(page.locator("h1")).toContainText("by city");
});

test("a city page lists exactly its published schemes, links to each, and carries its own title and structured data", async ({ page }) => {
  await page.goto(`/graduate-schemes/cities/${CITY_SLUG}`);
  await expect(page.locator("h1")).toContainText(CITY);
  const list = page.getByTestId("scheme-list");
  await expect(list).toContainText("E2ECT One");
  await expect(list).toContainText("E2ECT Two");
  await expect(list).not.toContainText("E2ECT Draft");
  await expect(page).toHaveTitle(new RegExp(`Graduate Schemes in ${CITY}`, "i"));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/graduate-schemes/cities/${CITY_SLUG}$`));
  const ld = await page.locator('script[type="application/ld+json"]').allInnerTexts();
  expect(ld.some((text) => JSON.parse(text)["@type"] === "ItemList" && JSON.parse(text).numberOfItems === 2)).toBe(true);
  await list.getByRole("link", { name: /Programme One/ }).first().click();
  await expect(page).toHaveURL(/\/graduate-schemes\/e2ect-one$/);
});

test("an unknown place, and one only a draft names, are 404", async ({ page }) => {
  for (const slug of ["no-such-place-anywhere", HIDDEN.toLowerCase()]) {
    const response = await page.goto(`/graduate-schemes/cities/${slug}`);
    expect(response?.status(), slug).toBe(404);
  }
});

test("the sitemap lists the place and not the draft's", async ({ request }) => {
  const xml = await (await request.get(`${BASE_URL}/sitemap.xml`)).text();
  expect(xml).toContain(`/graduate-schemes/cities/${CITY_SLUG}`);
  expect(xml).not.toContain(HIDDEN.toLowerCase());
  expect(xml).toContain("/graduate-schemes/cities<");
});

test("the cities pages fit a phone", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  for (const path of ["/graduate-schemes/cities", `/graduate-schemes/cities/${CITY_SLUG}`]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
  }
  await context.close();
});
