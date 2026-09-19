import { test, expect } from "../fixtures";
import { markOnboarded } from "../support/roles";

test.describe("CV creation and export", () => {
  test("creates a CV, fills in real content, autosaves it, and exports a PDF", async ({ authenticatedPage }) => {
    const { page, user } = authenticatedPage;
    // These tests are about creating, saving and exporting a CV, not about onboarding (e2e/onboarding covers that).
    await markOnboarded(user.id);

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
    // The header reports the editor's real save state: it flips to Saving the moment a field changes and back to
    // Saved only once the server has confirmed it (it used to say "All changes saved" unconditionally).
    const saveStatus = page.locator("[data-save-state]");
    await expect(saveStatus).toHaveAttribute("data-save-state", "saving");
    await expect(saveStatus).toHaveAttribute("data-save-state", "saved");

    // A save that survives a reload is the real proof it reached the
    // database, not just this tab's own in-memory state.
    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("E2E Test Candidate");

    // Export: saves anything pending, asks the server for the PDF of the template on screen, checks which template it
    // was drawn with, then downloads it. (See cv-builder-persistence.spec.ts for the content/consistency checks.)
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("a saved CV title and section content are still there after navigating away and back", async ({ authenticatedPage }) => {
    const { page, user } = authenticatedPage;
    // These tests are about creating, saving and exporting a CV, not about onboarding (e2e/onboarding covers that).
    await markOnboarded(user.id);

    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "New CV" }).first().click(); // two "New CV" triggers exist together on a fresh, empty CV list (the header's default one + the empty-state's own) — either opens the identical dialog.
    await page.getByLabel("Title").fill("Persistence Check CV");
    await page.getByRole("button", { name: "Create CV" }).click();
    await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/);

    await page.getByLabel("Full name").fill("Persisted Candidate");
    await page.getByLabel("Full name").blur();
    const saveStatus = page.locator("[data-save-state]");
    await expect(saveStatus).toHaveAttribute("data-save-state", "saving");
    await expect(saveStatus).toHaveAttribute("data-save-state", "saved");

    await page.goto("/dashboard/cvs");
    await expect(page.getByText("Persistence Check CV")).toBeVisible();

    await page.getByText("Persistence Check CV").click();
    await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/);
    await expect(page.getByLabel("Full name")).toHaveValue("Persisted Candidate");
  });
});
