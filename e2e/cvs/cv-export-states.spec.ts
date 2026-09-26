import { expect, type Route } from "@playwright/test";
import { makeCvTest, openSeededEditor } from "../support/cv-fixture";

// The PDF button's honest states: busy while it works, an error you can read when it can't (server error, server
// unreachable, a PDF in the wrong template), never a silent nothing — and it works again on the next try.

const test = makeCvTest({ name: "CV Export States Tester" });
const EXPORT_URL = "**/api/cvs/*/export*";

test.describe("PDF export states", () => {
  test("a server error is shown, the button comes back, and the next try downloads", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    let failing = true;
    await page.route(EXPORT_URL, async (route: Route) => {
      if (failing) await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Couldn't generate that PDF - try again." }) });
      else await route.continue();
    });
    const button = page.getByRole("button", { name: "PDF", exact: true });
    await button.click();
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't generate that PDF" })).toBeVisible();
    await expect(button).toBeEnabled();

    failing = false;
    const download = page.waitForEvent("download");
    await button.click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/i);
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't generate that PDF" })).toHaveCount(0); // the old error is cleared
  });

  test("while a PDF is being made the button is busy and can't be double-clicked", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    let requests = 0;
    await page.route(EXPORT_URL, async (route: Route) => {
      requests += 1;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    const button = page.getByRole("button", { name: "PDF", exact: true });
    const download = page.waitForEvent("download");
    await button.click();
    await expect(button).toBeDisabled();
    await download;
    await expect(button).toBeEnabled();
    expect(requests).toBe(1);
  });

  test("an unreachable server is reported as a connection problem", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    await page.route(EXPORT_URL, (route: Route) => route.abort());
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /reach the server/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "PDF", exact: true })).toBeEnabled();
  });

  test("a PDF drawn in a different template from the preview is refused, not downloaded", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id, { template: "single-navy" });
    let downloaded = false;
    page.on("download", () => {
      downloaded = true;
    });
    await page.route(EXPORT_URL, (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/pdf", headers: { "X-Cv-Template": "oxford", "Access-Control-Expose-Headers": "X-Cv-Template" }, body: "%PDF-1.4" }),
    );
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /different template/i })).toBeVisible();
    await page.waitForTimeout(500);
    expect(downloaded).toBe(false);
  });

  test("if the CV's changes can't be saved, the export says so instead of exporting stale content", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    let exportRequests = 0;
    await page.route(EXPORT_URL, async (route: Route) => {
      exportRequests += 1;
      await route.continue();
    });
    // Every save fails.
    await page.route("**/dashboard/cvs/**", (route: Route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) return route.abort();
      return route.continue();
    });
    await page.getByLabel("Headline").fill("Unsaveable Edit");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /aren't saved yet/i })).toBeVisible({ timeout: 20_000 });
    expect(exportRequests).toBe(0);
  });
});
