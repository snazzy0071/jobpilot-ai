import { test as base, expect, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { makeInstitutionAdmin, makeSuperAdmin, markOnboarded } from "../support/roles";

// Post-login redirect by role, through the one shared /login page: each role
// lands on its own home; an explicit redirect is honoured only when valid
// for the role; an already-signed-in visitor to /login is bounced home.

type Role = "admin" | "institution_admin" | "user";
type Accounts = Record<Role, IsolatedUser>;

const HOME: Record<Role, RegExp> = {
  admin: /\/admin$/,
  institution_admin: /\/institution-admin$/,
  user: /\/dashboard$/,
};

const test = base.extend<object, { accounts: Accounts }>({
  accounts: [
    async ({}, use) => {
      const admin = await createIsolatedUser({ fullName: "Redirect Admin" });
      const inst = await createIsolatedUser({ fullName: "Redirect Institution Admin" });
      const user = await createIsolatedUser({ fullName: "Redirect User" });
      await makeSuperAdmin(admin.id);
      const institutionId = await makeInstitutionAdmin(inst.id);
      await markOnboarded(user.id);
      try {
        await use({ admin, institution_admin: inst, user });
      } finally {
        await getAdminClient().from("admin_audit_logs").delete().eq("actor_id", admin.id);
        await getAdminClient().from("institutions").delete().eq("id", institutionId);
        await deleteIsolatedUser(admin.id);
        await deleteIsolatedUser(inst.id);
        await deleteIsolatedUser(user.id);
      }
    },
    { scope: "worker", timeout: 120_000 },
  ],
});

async function signIn(page: Page, account: IsolatedUser, from = "/login") {
  await page.goto(from);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const ROLES: Role[] = ["admin", "institution_admin", "user"];

// Sign-in is rate limited per IP (10 per 5 minutes), so this file keeps its real password sign-ins to the
// minimum needed to cover each behaviour of the sign-in action (7). Everything about an ALREADY signed-in
// visitor reuses the sessions saved by the first three tests, which is why the file runs serially.
test.describe.configure({ mode: "serial" });
const sessionFile = (role: Role) => `test-results/.role-redirect-${role}.json`;

test.describe("post-login redirect by role", () => {
  for (const role of ROLES) {
    test(`${role}: signing in at /login lands on their own home`, async ({ page, accounts }) => {
      await signIn(page, accounts[role]);
      await page.waitForURL(HOME[role]);
      await page.context().storageState({ path: sessionFile(role) });
    });
  }

  for (const role of ROLES) {
    test(`${role}: an already signed-in visit to /login or /signup goes straight to their home`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ baseURL, storageState: sessionFile(role) });
      const page = await context.newPage();
      await page.goto("/login");
      await expect(page).toHaveURL(HOME[role]);
      await page.goto("/signup");
      await expect(page).toHaveURL(HOME[role]);
      await context.close();
    });
  }

  test("an already signed-in admin is never defaulted to /dashboard, even with ?redirect=/dashboard", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, storageState: sessionFile("admin") });
    const page = await context.newPage();
    await page.goto("/login?redirect=/dashboard/cvs");
    await expect(page).toHaveURL(HOME.admin);
    await page.goto("/login?redirect=/admin/users");
    await expect(page).toHaveURL(/\/admin\/users$/);
    await context.close();
  });

  test("an already signed-in user or institution admin can't be pointed into another role's area, or off-site", async ({ browser, baseURL }) => {
    const userContext = await browser.newContext({ baseURL, storageState: sessionFile("user") });
    const userPage = await userContext.newPage();
    await userPage.goto("/login?redirect=/admin");
    await expect(userPage).toHaveURL(HOME.user);
    await userPage.goto("/login?redirect=//evil.example");
    await expect(userPage).toHaveURL(HOME.user);
    await userContext.close();

    const instContext = await browser.newContext({ baseURL, storageState: sessionFile("institution_admin") });
    const instPage = await instContext.newPage();
    await instPage.goto("/login?redirect=/dashboard");
    await expect(instPage).toHaveURL(HOME.institution_admin);
    await instContext.close();
  });

  test("the protected-page bounce round-trips for the right role: /admin/users while signed out -> login -> /admin/users", async ({ page, accounts }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin%2Fusers/);
    await signIn(page, accounts.admin, page.url());
    await page.waitForURL(/\/admin\/users$/);
  });

  test("signing in with a redirect into another role's area drops it: the admin goes to /admin, never /dashboard", async ({ page, accounts }) => {
    await signIn(page, accounts.admin, "/login?redirect=/dashboard/cvs");
    await page.waitForURL(HOME.admin);
  });

  test("signing in as a user with ?redirect=/admin stays on /dashboard", async ({ page, accounts }) => {
    await signIn(page, accounts.user, "/login?redirect=/admin");
    await page.waitForURL(HOME.user);
  });

  test("signing in as an institution admin with ?redirect=/dashboard goes to /institution-admin", async ({ page, accounts }) => {
    await signIn(page, accounts.institution_admin, "/login?redirect=/dashboard");
    await page.waitForURL(HOME.institution_admin);
  });
});
