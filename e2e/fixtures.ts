import { test as base, expect, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "./support/test-user";

type Fixtures = {
  /** A real, pre-confirmed, isolated Supabase user — created before the test, deleted (cascading to everything it owns) after. Not logged in. */
  testUser: IsolatedUser;
  /** `testUser`, already signed in via the real login form — lands wherever a fresh account's first login actually goes (`/onboarding`). */
  authenticatedPage: { page: Page; user: IsolatedUser };
};

export const test = base.extend<Fixtures>({
  testUser: async ({}, use) => {
    const user = await createIsolatedUser();
    await use(user);
    await deleteIsolatedUser(user.id);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Password", { exact: true }).fill(testUser.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/onboarding/);
    await use({ page, user: testUser });
  },
});

export { expect };

/** A fresh, unonboarded `authenticatedPage` always lands on /onboarding/about — walks all three real steps with plausible defaults so a test that needs a *past-onboarding* dashboard doesn't have to duplicate this every time. */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.waitForURL(/\/onboarding\/about/);
  await selectOption(page, "Career stage", "Recently graduated");
  await selectOption(page, "What's your main goal right now?", "Land my first role");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.waitForURL(/\/onboarding\/targets/);
  await page.getByLabel("Target roles").fill("Software Engineer");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.waitForURL(/\/onboarding\/logistics/);
  await page.getByLabel("Location").fill("London");
  await page.getByLabel("Graduation year").fill("2024");
  await selectOption(page, "Right to work / sponsorship", "I already have the right to work");
  await page.getByRole("button", { name: "Finish" }).click();

  await page.waitForURL(/\/dashboard(?!\/)/);
}

/**
 * Base UI's Select renders an accessible combobox trigger + a listbox
 * popup — `getByLabel` finds the trigger by its associated <Label>, a
 * plain click opens the popup, and the option is then a real
 * `role="option"` node in the (portalled) popup, which Playwright's
 * auto-waiting `getByRole` finds regardless of DOM position.
 */
export async function selectOption(page: Page, labelText: string, optionText: string): Promise<void> {
  await page.getByLabel(labelText, { exact: true }).click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}
