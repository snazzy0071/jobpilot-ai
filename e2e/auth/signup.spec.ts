import { test, expect } from "../fixtures";
import { uniqueEmail, deleteIsolatedUserByEmail } from "../support/test-user";

// Signup is the one flow that can't use the createIsolatedUser
// shortcut (that bypasses email confirmation on purpose, which is
// exactly what this spec exists to exercise) — it drives the real form
// and cleans up afterward by email instead of by id.

test.describe("Signup", () => {
  test("creating an account with a real, unique email lands on the check-your-inbox screen", async ({ page }) => {
    const email = uniqueEmail();

    try {
      await page.goto("/signup");
      await page.getByLabel("Full name").fill("E2E Signup Test");
      await page.getByLabel("Email", { exact: true }).fill(email);
      await page.getByLabel("Date of birth").fill("2000-01-01");
      await page.getByLabel("Password", { exact: true }).fill("A-Real-Password-123!");
      await page.getByRole("button", { name: "Create account" }).click();

      // Supabase's built-in mailer allows only a couple of confirmation emails an hour per project and refuses the reserved e2e domain.
      // Both are project-level limits (lifted by configuring custom SMTP), not something this app controls, so report a skip, not a failure.
      const outcome = await Promise.race([
        page.waitForURL(/\/signup\/check-email/).then(() => "sent" as const).catch(() => "timeout" as const),
        page.getByRole("alert").filter({ hasText: /email rate limit exceeded|is invalid/ }).waitFor().then(() => "limited" as const).catch(() => "timeout" as const),
      ]);
      test.skip(outcome === "limited", "Supabase's built-in mailer refuses or rate-limits this address; configure custom SMTP to run this end to end.");
      await page.waitForURL(/\/signup\/check-email/);
      await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
      // The email itself is echoed back into the confirmation copy —
      // real confirmation that the account was created for *this*
      // address, not just that some redirect happened.
      await expect(page.getByText(email)).toBeVisible();
    } finally {
      await deleteIsolatedUserByEmail(email);
    }
  });

  test("rejects an obviously too-young date of birth with an inline error, not a silent failure", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/signup");
    await page.getByLabel("Full name").fill("E2E Underage Test");
    await page.getByLabel("Email", { exact: true }).fill(email);
    const eightYearsAgo = new Date();
    eightYearsAgo.setFullYear(eightYearsAgo.getFullYear() - 8);
    await page.getByLabel("Date of birth").fill(eightYearsAgo.toISOString().slice(0, 10));
    await page.getByLabel("Password", { exact: true }).fill("A-Real-Password-123!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
    // No account should exist to clean up — the schema validation
    // rejects this before any Supabase call is made — but delete
    // defensively in case that assumption is ever wrong.
    await deleteIsolatedUserByEmail(email);
  });

  test("signing up with an email that's already registered never creates a second account", async ({ testUser, page }) => {
    // The actual UX here depends on the Supabase project's own email-
    // enumeration-protection setting (an inline "already registered"
    // error either way, or — with that protection on — the same "check
    // your inbox" screen a real new signup gets, specifically so a
    // stranger can't use this form to probe which emails already have
    // accounts) — not something this suite controls or should assume.
    // What must always hold regardless of that setting: still exactly
    // one real account for this email afterward, never two.
    await page.goto("/signup");
    await page.getByLabel("Full name").fill("E2E Duplicate Test");
    await page.getByLabel("Email", { exact: true }).fill(testUser.email);
    await page.getByLabel("Date of birth").fill("2000-01-01");
    await page.getByLabel("Password", { exact: true }).fill("A-Different-Password-456!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByRole("alert").or(page.getByRole("heading", { name: "Check your inbox" }))).toBeVisible();

    const { getAdminClient } = await import("../support/admin-client");
    const { data } = await getAdminClient().auth.admin.listUsers({ page: 1, perPage: 200 });
    const matches = (data?.users ?? []).filter((user) => user.email === testUser.email);
    expect(matches).toHaveLength(1);
  });
});
