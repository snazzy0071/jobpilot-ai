import { expect, test, type Page } from "@playwright/test";

// The Skilled Worker salary calculator in a real browser: it is a plain GET form (so it works without JavaScript and results are
// shareable links), gives the right answer for each rate, says what it cannot know, shows the source and check date, and fits a phone.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const PATH = "/skilled-worker-salary-calculator";

async function check(page: Page, fields: { salary: string; category?: string; goingRate?: string }) {
  await page.goto(PATH);
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
  await page.getByLabel("Annual salary offered (£)").fill(fields.salary);
  if (fields.category) await page.getByLabel("Which rate applies to you?").selectOption(fields.category);
  if (fields.goingRate) await page.getByLabel(/Going rate for the job/).fill(fields.goingRate);
  await page.getByRole("button", { name: "Check this salary" }).click();
}

const result = (page: Page) => page.getByRole("status").filter({ has: page.getByRole("heading") });

test("a salary above the going rate and the threshold meets the minimum", async ({ page }) => {
  await check(page, { salary: "£45,000", goingRate: "38000" });
  await expect(result(page)).toHaveAttribute("data-result", "meets");
  await expect(result(page)).toContainText("meets the minimum");
  await expect(result(page)).toContainText("£41,700");
});

test("a salary below a high going rate says how far short it is", async ({ page }) => {
  await check(page, { salary: "45000", goingRate: "52000" });
  await expect(result(page)).toHaveAttribute("data-result", "below");
  await expect(result(page)).toContainText("£7,000 a year short");
});

test("the new-entrant rate uses 70% of the going rate with its lower floor", async ({ page }) => {
  await check(page, { salary: "34000", category: "new_entrant", goingRate: "40000" });
  await expect(result(page)).toHaveAttribute("data-result", "meets");
  await expect(result(page)).toContainText("70% of the going rate");
  await expect(result(page)).toContainText("£28,000");
  await expect(result(page)).toContainText("£33,400");
});

test("without the going rate it says so instead of guessing, and a salary under the floor is a clear no", async ({ page }) => {
  await check(page, { salary: "60000" });
  await expect(result(page)).toHaveAttribute("data-result", "unconfirmed");
  await expect(result(page)).toContainText("going rate");
  await check(page, { salary: "30000" });
  await expect(result(page)).toHaveAttribute("data-result", "below");
  await expect(result(page)).toContainText("£11,700 a year short");
});

test("nonsense input gets an inline message, and no result", async ({ page }) => {
  await check(page, { salary: "lots" });
  await expect(page.getByRole("alert").filter({ hasText: "Enter your annual salary" })).toBeVisible();
  await expect(result(page)).toHaveCount(0);
  await check(page, { salary: "45000", goingRate: "abc" });
  await expect(page.getByRole("alert").filter({ hasText: "going rate" })).toBeVisible();
});

test("the result is a shareable link and the page names its sources and the date it was checked", async ({ page }) => {
  await page.goto(`${PATH}?salary=45000&goingRate=38000&category=standard`);
  await expect(result(page)).toContainText("meets the minimum");
  await expect(page.getByText(/Figures last checked on 26 September 2026/)).toBeVisible();
  await expect(page.getByRole("link", { name: /GOV\.UK: Skilled Worker visa, your job/ })).toHaveAttribute("href", "https://www.gov.uk/skilled-worker-visa/your-job");
  await expect(page.getByRole("link", { name: "official going rates table" })).toHaveAttribute("href", /skilled-worker-visa-going-rates-for-eligible-occupations/);
  await expect(page.getByText(/not immigration advice/i).first()).toBeVisible();
});

test("an unknown rate in the address falls back to the standard rate", async ({ page }) => {
  await page.goto(`${PATH}?salary=45000&goingRate=38000&category=<script>`);
  await expect(result(page)).toContainText("meets the minimum");
});

test("it fits a phone and is reachable from the visa menu", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${PATH}?salary=34000&category=new_entrant&goingRate=40000`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await context.close();
  const desktopContext = await browser.newContext({ baseURL: BASE_URL });
  const desktop = await desktopContext.newPage();
  await desktop.goto("/visa-sponsors");
  await expect(desktop.getByRole("link", { name: "Skilled Worker Salary Calculator" }).first()).toHaveAttribute("href", PATH);
  await desktopContext.close();
});
