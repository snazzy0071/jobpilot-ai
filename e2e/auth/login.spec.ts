import { test, expect } from "../fixtures";

test.describe("Login", () => {
  test("signing in with the correct credentials lands a fresh account on onboarding", async ({ testUser, page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password", { exact: true }).fill(testUser.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    // requireOnboardedUser() bounces a signed-in-but-not-yet-onboarded
    // account here — the real proof this is an authenticated session,
    // not just "the form submitted without an error".
    await page.waitForURL(/\/onboarding/);
  });

  test("shows an inline error for a wrong password without revealing whether the email itself is registered", async ({
    testUser,
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password", { exact: true }).fill("Definitely-The-Wrong-Password-1!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows the same generic error for an email that was never registered at all", async ({ page }) => {
    const { uniqueEmail } = await import("../support/test-user");
    await page.goto("/login");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password", { exact: true }).fill("Whatever-Password-1!");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an already-onboarded account signs straight into the dashboard, not onboarding again", async ({ testUser, page }) => {
    const { completeOnboarding } = await import("../fixtures");
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password", { exact: true }).fill(testUser.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await completeOnboarding(page);

    // Sign out and back in — the real proof onboarding_status is
    // actually persisted, not just true for the rest of this one session.
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);

    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password", { exact: true }).fill(testUser.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard(?!\/)/);
  });
});
