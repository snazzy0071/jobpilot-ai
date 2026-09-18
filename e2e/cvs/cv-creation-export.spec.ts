import { test, expect, completeOnboarding } from "../fixtures";

test.describe("CV creation and export", () => {
  test("creates a CV, fills in real content, autosaves it, and exports a PDF", async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    await completeOnboarding(page);

    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "New CV" }).first().click(); // two "New CV" triggers exist together on a fresh, empty CV list (the header's default one + the empty-state's own) — either opens the identical dialog.
    await page.getByLabel("Title").fill("E2E Test CV");
    await page.getByRole("button", { name: "Create CV" }).click();

    // createCv redirects straight into the editor at /dashboard/cvs/{id}.
    await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/);
    await expect(page.getByRole("heading", { name: /1\. Personal details/ })).toBeVisible();

    // PersonalForm autosaves on change (no submit button) — fill the
    // required field and wait for the real "Saved" status, not just a
    // fixed timeout that would pass whether or not the save actually
    // completed.
    await page.getByLabel("Full name").fill("E2E Test Candidate");
    await page.getByLabel("Full name").blur();
    await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible(); // AutosaveStatus specifically (role="status") — not EditorHeader's unrelated plain-<span> "All changes saved" rename indicator, which would be a false positive.

    // A save that survives a reload is the real proof it reached the
    // database, not just this tab's own in-memory state.
    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("E2E Test Candidate");

    // Export: a plain <a target="_blank"> to /api/cvs/{id}/export —
    // opens a new tab whose response is the actual PDF download.
    const [downloadPage] = await Promise.all([
      page.context().waitForEvent("page"),
      page.getByRole("link", { name: "PDF" }).click(),
    ]);
    const response = await downloadPage.waitForEvent("response", (res) => res.url().includes("/api/cvs/") && res.url().includes("/export"));
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    await downloadPage.close();
  });

  test("a saved CV title and section content are still there after navigating away and back", async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    await completeOnboarding(page);

    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "New CV" }).first().click(); // two "New CV" triggers exist together on a fresh, empty CV list (the header's default one + the empty-state's own) — either opens the identical dialog.
    await page.getByLabel("Title").fill("Persistence Check CV");
    await page.getByRole("button", { name: "Create CV" }).click();
    await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/);

    await page.getByLabel("Full name").fill("Persisted Candidate");
    await page.getByLabel("Full name").blur();
    await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible(); // AutosaveStatus specifically (role="status") — not EditorHeader's unrelated plain-<span> "All changes saved" rename indicator, which would be a false positive.

    await page.goto("/dashboard/cvs");
    await expect(page.getByText("Persistence Check CV")).toBeVisible();

    await page.getByText("Persistence Check CV").click();
    await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/);
    await expect(page.getByLabel("Full name")).toHaveValue("Persisted Candidate");
  });
});
