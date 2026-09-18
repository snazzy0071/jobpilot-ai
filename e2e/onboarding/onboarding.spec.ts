import { test, expect, selectOption } from "../fixtures";

// Real step order, confirmed from src/lib/onboarding/actions.ts's own
// redirects (not assumed from the folder layout, which would suggest
// about -> logistics -> targets and get it backwards):
// about -> targets -> logistics -> dashboard.

test.describe("Onboarding", () => {
  test("walks all three real steps in order and lands on the dashboard", async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;

    await expect(page).toHaveURL(/\/onboarding\/about/);
    await selectOption(page, "Career stage", "Recently graduated");
    await selectOption(page, "What's your main goal right now?", "Land my first role");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/onboarding\/targets/);
    await page.getByLabel("Target roles").fill("Software Engineer, Data Analyst");
    await page.getByLabel("Technology").check();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/onboarding\/logistics/);
    await page.getByLabel("Location").fill("Manchester");
    await page.getByLabel("Graduation year").fill("2023");
    await selectOption(page, "Right to work / sponsorship", "I'll need visa sponsorship");
    await page.getByRole("button", { name: "Finish" }).click();

    await page.waitForURL(/\/dashboard(?!\/)/);
  });

  test("a skipped onboarding still reaches the dashboard, and a direct revisit doesn't force it again", async ({
    authenticatedPage,
  }) => {
    const { page } = authenticatedPage;

    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.waitForURL(/\/dashboard(?!\/)/);

    // requireOnboardedUser() only bounces to /onboarding while
    // onboarding_status isn't 'completed' — skipping must actually mark
    // it complete (however the app defines "skipped"), not just show
    // the dashboard for this one navigation before bouncing back.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard(?!\/)/);
  });

  test("rejects a graduation year outside the real bounds", async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    await selectOption(page, "Career stage", "Recently graduated");
    await selectOption(page, "What's your main goal right now?", "Land my first role");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Target roles").fill("Software Engineer");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Location").fill("London");
    const yearInput = page.getByLabel("Graduation year");
    await yearInput.fill("1900");
    // The <input min=1950 max=2100> mirrors the same bound the server
    // enforces, so the browser's own constraint validation would block
    // submission before the request ever reached the server at all —
    // stripping it here isolates what this test actually wants to prove:
    // the *server-side* schema bound (src/lib/onboarding/schemas.ts)
    // holds even if a client-side check is ever bypassed, not just that
    // HTML5 validation works.
    await yearInput.evaluate((el: HTMLInputElement) => el.removeAttribute("min"));
    await selectOption(page, "Right to work / sponsorship", "Not sure yet");
    await page.getByRole("button", { name: "Finish" }).click();

    await expect(page).toHaveURL(/\/onboarding\/logistics/);
    await expect(page.getByText("Enter a valid year")).toBeVisible();
  });
});
