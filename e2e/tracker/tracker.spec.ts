import { test, expect, completeOnboarding } from "../fixtures";

test.describe("Tracker", () => {
  test("creates an application, moves it to Applied, and freezes its sponsor snapshot", async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    await completeOnboarding(page);

    const jobTitle = "E2E Tracker Role";
    await page.goto("/dashboard/applications/new");
    await page.getByLabel("Company").fill("E2E Tracker Co");
    await page.getByLabel("Role").fill(jobTitle);
    await page.getByRole("button", { name: "Add application" }).click();

    await page.waitForURL(/\/dashboard\/applications$/);
    await expect(page.getByText(jobTitle)).toBeVisible();

    // The per-card status Select — application-tracker-board.tsx's own
    // real, touch/keyboard-operable way to change status (the
    // drag-and-drop kanban itself uses native HTML5 DnD, which has no
    // touch/automation-friendly path — this Select is deliberately
    // there as the actual accessible mechanism, not a fallback).
    await page.getByRole("combobox", { name: `Move ${jobTitle} to a different status` }).click();
    await page.getByRole("option", { name: "Applied", exact: true }).click();

    // resolveSnapshotFreeze (src/lib/applications/snapshot.ts) freezes
    // sponsor status/CV version/match score the moment status first
    // becomes "applied" — the lock icon is the one visible proof this
    // actually happened, not just that the status label changed.
    await expect(
      page.getByRole("img", { name: "Frozen since first moved to Applied" }),
    ).toBeVisible();
  });

  test("moving an application back out of Applied does not unfreeze it", async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    await completeOnboarding(page);

    const jobTitle = "E2E Unfreeze Check Role";
    await page.goto("/dashboard/applications/new");
    await page.getByLabel("Company").fill("E2E Unfreeze Co");
    await page.getByLabel("Role").fill(jobTitle);
    await page.getByRole("button", { name: "Add application" }).click();
    await page.waitForURL(/\/dashboard\/applications$/);

    await page.getByRole("combobox", { name: `Move ${jobTitle} to a different status` }).click();
    await page.getByRole("option", { name: "Applied", exact: true }).click();
    await expect(page.getByRole("img", { name: "Frozen since first moved to Applied" })).toBeVisible();

    await page.getByRole("combobox", { name: `Move ${jobTitle} to a different status` }).click();
    await page.getByRole("option", { name: "Interview", exact: true }).click();

    // resolveSnapshotFreeze's own "already frozen" branch: once
    // frozen_at is set, it stays set regardless of later status moves —
    // the lock must still be visible even though status has moved on.
    await expect(page.getByRole("img", { name: "Frozen since first moved to Applied" })).toBeVisible();
  });

  test("the table view shows the same application data as the kanban board", async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    await completeOnboarding(page);

    const jobTitle = "E2E Table View Role";
    await page.goto("/dashboard/applications/new");
    await page.getByLabel("Company").fill("E2E Table View Co");
    await page.getByLabel("Role").fill(jobTitle);
    await page.getByRole("button", { name: "Add application" }).click();
    await page.waitForURL(/\/dashboard\/applications$/);

    await page.getByRole("button", { name: "Table" }).click(); // a real toggle button (aria-pressed), not a Tabs/TabsTrigger widget
    await expect(page.getByRole("cell", { name: jobTitle })).toBeVisible();
  });
});
