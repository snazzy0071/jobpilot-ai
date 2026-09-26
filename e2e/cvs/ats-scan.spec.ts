import { test, expect, completeOnboarding } from "../fixtures";
import { setPlan } from "../support/roles";

// Requires a real ANTHROPIC_API_KEY configured on the server this suite
// runs against — runAtsScan (src/lib/cvs/ats-actions.ts) calls the real
// AI gateway. Without one, generateStructuredGated fails closed with
// "AI features aren't available right now" (src/lib/ai/service.ts's
// getClientOrThrowConfigError) — a real, correct behavior in its own
// right, just not the successful-scan path this spec's first test
// wants to exercise. See e2e/README.md.

test.describe("ATS scan", () => {
  test("running a scan against a real job description returns real scores and keyword feedback", async ({ authenticatedPage }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, "Needs ANTHROPIC_API_KEY (real, or the mocked-provider mode); the same flow is covered by cv-ats-preflight and ats-scanner under the mock.");
    const { page, user } = authenticatedPage;
    await setPlan(user.id, "premium"); // tailored ATS scans are a paid-plan feature
    await completeOnboarding(page);

    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "New CV" }).first().click();
    await page.getByLabel("Title").fill("E2E ATS Scan CV");
    await page.getByRole("button", { name: "Create CV" }).click();
    await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/);

    // A close-to-empty CV is a legitimate scan target — the deterministic
    // format-issue half (src/lib/cvs/ats-format-checks.ts) doesn't need
    // real content, and this keeps the fixture setup minimal. Give it a
    // name so the AI half has at least something to reason about.
    await page.getByLabel("Full name").fill("E2E ATS Candidate");
    await page.getByLabel("Full name").blur();
    await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible();

    await page
      .getByLabel("Paste a job description")
      .fill(
        "We are hiring a Junior Software Engineer with experience in TypeScript, React, and SQL. " +
          "You will build and maintain web applications, write tests, and collaborate with a small team.",
      );
    await page.getByRole("button", { name: "Run ATS scan" }).click();

    await expect(page.getByRole("button", { name: "Re-score" })).toBeVisible({ timeout: 30_000 });
    // A real overall score renders as a number somewhere in the panel —
    // not asserting an exact value (the AI's judgment, not deterministic),
    // just that a genuine scored result replaced the empty/loading state.
    await expect(page.getByText(/\d{1,3}\s*\/\s*100/)).toBeVisible();
  });

  test("the deterministic format checks appear immediately, with no AI call needed", async ({ authenticatedPage }) => {
    const { page } = authenticatedPage;
    await completeOnboarding(page);

    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "New CV" }).first().click();
    await page.getByLabel("Title").fill("E2E Format Check CV");
    await page.getByRole("button", { name: "Create CV" }).click();
    await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/);

    // computeFormatIssues runs client-side on every keystroke
    // (src/lib/cvs/ats-format-checks.ts) — a completely empty CV should
    // immediately show its real, deterministic gaps without ever
    // touching the AI gateway or waiting on a server round trip.
    await expect(page.getByText(/add your full name/i)).toBeVisible();
    await expect(page.getByText(/add a professional summary/i)).toBeVisible();
  });
});
