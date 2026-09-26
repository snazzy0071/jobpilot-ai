import { test, expect } from "../fixtures";
import { markOnboarded } from "../support/roles";

// These tests are about the settings forms, not onboarding (e2e/onboarding covers that), so the account is
// marked onboarded directly. Settings is a two-column page: the navigation on the left switches which
// section's form is shown on the right, so the form under test is opened through its tab first.

test.describe("Settings", () => {
  test("updating the profile form persists the new name across a reload", async ({ authenticatedPage }) => {
    const { page, user } = authenticatedPage;
    await markOnboarded(user.id);

    await page.goto("/dashboard/settings");
    await page.getByLabel("Full name").fill("Updated E2E Name");
    await page.getByLabel("Date of birth").fill("1998-04-12"); // required by the form
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByRole("status").filter({ hasText: /saved|updated/i })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("Updated E2E Name");
  });

  test("deleting the account requires typing the exact confirmation text", async ({ authenticatedPage }) => {
    const { page, user } = authenticatedPage;
    await markOnboarded(user.id);

    await page.goto("/dashboard/settings");
    await page.getByRole("tab", { name: "Privacy" }).click();
    await page.getByLabel(/type.*delete.*to confirm/i).fill("delete"); // lowercase — must not satisfy an exact-match confirmation
    await page.getByRole("button", { name: "Delete my account" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    // Still signed in — a rejected confirmation must not have deleted anything.
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test("deleting the account with the correct confirmation actually removes it — signed out, and the credentials no longer work", async ({
    testUser,
    page,
  }) => {
    await markOnboarded(testUser.id);
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password", { exact: true }).fill(testUser.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard$/);

    await page.goto("/dashboard/settings");
    await page.getByRole("tab", { name: "Privacy" }).click();
    await page.getByLabel(/type.*delete.*to confirm/i).fill("DELETE");
    // Deleting an account needs the current password as well as the typed confirmation.
    await page.locator("#currentPasswordForDelete").fill(testUser.password);
    await page.getByRole("button", { name: "Delete my account" }).click();

    // eraseUserAccount + auth.signOut() + redirect("/") — real proof the
    // session itself, not just the dashboard UI, is gone.
    await page.waitForURL(/^https?:\/\/[^/]+\/?$/);

    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password", { exact: true }).fill(testUser.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    // The testUser fixture's own afterward cleanup will attempt to
    // delete this same, already-deleted account next — harmless: see
    // deleteIsolatedUser's own comment on why that's never fatal to a
    // test run.
  });
});
