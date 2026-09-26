import { test, expect } from "../fixtures";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";

// These start from a signed-in fresh account. The onboarding wizard has its own spec; here the account is simply marked onboarded
// (the wizard's selectors changed and are not what this suite is about).

// A freshly created, isolated account has no subscriptions row at all,
// which src/lib/entitlements/service.ts's getEntitlements() resolves to
// Free's entitlements (fail-closed) — exactly the plan this suite wants
// to test gating against, with no extra setup needed.

test.describe("Plan gating", () => {
  test("a free-plan user sees the upgrade prompt in the sidebar", async ({ authenticatedPage }) => {
    const { page, user } = authenticatedPage;
    await markOnboarded(user.id);
    await page.goto("/dashboard");

    // DashboardSidebar only renders PlanUpgradeCard when plan === "free"
    // — "Free plan" text appears twice on the page (the sidebar's own
    // plan label, and PlanUpgradeCard's own copy), so .first() rather
    // than an exact single match.
    await expect(page.getByText("Free plan").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Upgrade", exact: true }).first()).toBeVisible();
  });

  test("generating a cover letter — a Premium feature — is blocked server-side with a real entitlement error, not silently allowed", async ({
    authenticatedPage,
  }) => {
    const { page, user } = authenticatedPage;
    await markOnboarded(user.id);
    await page.goto("/dashboard");

    // A CV with real content (an empty one is rejected earlier, for a different reason).
    await seedCv(user.id, { title: "E2E Gating CV" });

    await page.goto("/dashboard/cover-letters/new");
    await page.getByLabel("Job description").fill(
      "We are hiring a Junior Software Engineer with experience in TypeScript and React.",
    );
    await page.getByLabel("Company name").fill("E2E Gating Co");
    await page.getByLabel("Job title").fill("Junior Software Engineer");
    await page.getByRole("button", { name: "Generate cover letter" }).click();

    // generateCoverLetter (src/lib/cover-letters/actions.ts) is gated on
    // featureKey: "cover_letter_generator" via the AI gateway's
    // requireFeature — a Free plan doesn't include it, so this must
    // fail with the real EntitlementError message, not attempt (and
    // possibly succeed at, or silently no-op) a real AI generation.
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("isn't included in your current plan");
    // Still on the form — no cover letter was created to redirect to.
    await expect(page).toHaveURL(/\/dashboard\/cover-letters\/new/);
  });

  test("the free plan's real numeric limits are reflected in the CV list (cv_limit)", async ({ authenticatedPage }) => {
    const { page, user } = authenticatedPage;
    await markOnboarded(user.id);
    await page.goto("/dashboard");

    // migration 0016's seeded Free entitlements cap cv_limit at 1 — a
    // second CV attempt must be blocked server-side by
    // reserveCvSlot/requireUsageAllowed (src/lib/cvs/actions.ts), not
    // just hidden behind a disabled button a determined user could
    // still bypass by submitting the form directly.
    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "New CV" }).first().click();
    await page.getByLabel("Title").fill("E2E First CV");
    await page.getByRole("button", { name: "Create CV" }).click();
    await page.waitForURL(/\/dashboard\/cvs\/[^/]+$/);

    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "New CV" }).first().click();
    await page.getByLabel("Title").fill("E2E Second CV");
    await page.getByRole("button", { name: "Create CV" }).click();

    // reserveCvSlot -> requireUsageAllowed's real EntitlementError
    // message for a reached (not zero) limit — see
    // src/lib/entitlements/service.ts's requireUsageAllowed.
    await expect(page.getByRole("alert")).toContainText("You've reached your plan's limit for CVs");
    // Still on the CV list (dialog open, not redirected into a second editor).
    await expect(page).toHaveURL(/\/dashboard\/cvs$/);
  });
});
