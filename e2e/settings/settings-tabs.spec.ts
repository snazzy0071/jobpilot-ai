import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { dismissCookieBanner } from "../support/cv-fixture";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { markOnboarded } from "../support/roles";
import { openAs, signInState } from "../support/admin-session";

// The user-settings sections the layout spec doesn't cover, against the real database: notifications, career preferences, the connected
// providers panel, changing the password (which needs the current one), and joining an institution with an access code or a domain.
// One account signs in once and every test reuses that session.

test.describe.configure({ mode: "serial", timeout: 180_000 });

const db = () => getAdminClient();
const RUN = Date.now().toString(36);
let user: IsolatedUser;
let session: { user: IsolatedUser; state: unknown };
let institutionId = "";
const codes: string[] = [];

async function tab(page: Page, name: string) {
  await page.goto("/dashboard/settings");
  await dismissCookieBanner(page);
  await page.getByRole("tab", { name: new RegExp(`^${name}`) }).click();
}

test.beforeAll(async ({ browser }) => {
  user = await createIsolatedUser({ fullName: "Settings Tabs Tester" });
  await markOnboarded(user.id);
  await db().from("user_preferences").update({ career_stage: "student", primary_goal: "first_role", target_roles: ["Analyst"], industries: ["Technology"], location: "London", graduation_year: 2024, visa_sponsorship_preference: "unsure" }).eq("id", user.id);
  session = { user, state: await signInState(browser, user, /\/dashboard/) };
});

test.afterAll(async () => {
  if (codes.length) await db().from("access_codes").delete().in("code", codes);
  if (institutionId) await db().from("institutions").delete().eq("id", institutionId);
  await deleteIsolatedUser(user.id);
});

test("notifications: the email preference saves, is timestamped, and survives a reload", async ({ browser }) => {
  const page = await openAs(browser, session);
  await tab(page, "Notifications");
  const box = page.getByRole("checkbox", { name: /occasional emails/ });
  await expect(box).not.toBeChecked();
  await box.click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Notification preferences updated" })).toBeVisible();
  const { data } = await db().from("profiles").select("newsletter_opt_in, newsletter_opt_in_at").eq("id", user.id).single();
  expect(data!.newsletter_opt_in).toBe(true);
  expect(data!.newsletter_opt_in_at).not.toBeNull();

  await tab(page, "Notifications");
  await expect(page.getByRole("checkbox", { name: /occasional emails/ })).toBeChecked();
  await page.getByRole("checkbox", { name: /occasional emails/ }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Notification preferences updated" })).toBeVisible();
  expect((await db().from("profiles").select("newsletter_opt_in").eq("id", user.id).single()).data!.newsletter_opt_in).toBe(false);
  await page.context().close();
});

test("career preferences: saved to the account, shown again after a reload, and an impossible year is refused by the server", async ({ browser }) => {
  const page = await openAs(browser, session);
  await tab(page, "Career");
  await page.getByLabel("Target roles").fill("Data Analyst, Researcher");
  await page.getByLabel("Location").fill("Leeds");
  await page.getByLabel("Graduation year").fill("2025");
  await page.getByRole("checkbox", { name: "Finance & Banking" }).click();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Career preferences updated" })).toBeVisible();

  const { data } = await db().from("user_preferences").select("target_roles, industries, location, graduation_year").eq("id", user.id).single();
  expect(data!.target_roles).toEqual(["Data Analyst", "Researcher"]);
  expect(data!.industries).toEqual(expect.arrayContaining(["Technology", "Finance & Banking"]));
  expect(data!.location).toBe("Leeds");
  expect(data!.graduation_year).toBe(2025);

  await tab(page, "Career");
  await expect(page.getByLabel("Location")).toHaveValue("Leeds");
  await expect(page.getByLabel("Target roles")).toHaveValue("Data Analyst, Researcher");

  // The browser's own min/max would stop 1900 first; take it off to prove the server refuses it too.
  await page.getByLabel("Graduation year").evaluate((el: HTMLInputElement) => el.removeAttribute("min"));
  await page.getByLabel("Graduation year").fill("1900");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /valid year/i })).toBeVisible();
  expect((await db().from("user_preferences").select("graduation_year").eq("id", user.id).single()).data!.graduation_year).toBe(2025);
  await page.context().close();
});

test("connected providers: an email-and-password account shows the panel with nothing linked", async ({ browser }) => {
  const page = await openAs(browser, session);
  await tab(page, "Account");
  await expect(page.getByText("Connected login providers")).toBeVisible();
  await expect(page.getByText("Not connected")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Connect" })).toHaveCount(3);
  await page.context().close();
});

test("changing the password needs the current one and takes effect", async ({ browser }) => {
  const page = await openAs(browser, session);
  await tab(page, "Account");
  const NEW = `New-Password-${RUN}!`;
  const form = page.locator("form").filter({ has: page.locator("#confirmPassword") });
  await form.locator("#currentPasswordForPassword").fill("not-my-password");
  await form.getByLabel("New password", { exact: true }).fill(NEW);
  await form.getByLabel("Confirm new password").fill(NEW);
  await form.getByRole("button").click();
  await expect(form.getByRole("alert")).toContainText("isn't your current password");
  await expect(form.locator("#currentPasswordForPassword")).toHaveValue(""); // the form clears itself once the answer arrives

  await form.locator("#currentPasswordForPassword").fill(user.password);
  await form.getByLabel("New password", { exact: true }).fill(NEW);
  await form.getByLabel("Confirm new password").fill("something-else-entirely");
  await form.getByRole("button").click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(form.locator("#currentPasswordForPassword")).toHaveValue("");

  await form.locator("#currentPasswordForPassword").fill(user.password);
  await form.getByLabel("New password", { exact: true }).fill(NEW);
  await form.getByLabel("Confirm new password").fill(NEW);
  await form.getByRole("button").click();
  await expect(form.getByRole("status")).toContainText("Password updated");

  // The new password now signs in against Supabase directly; the old one no longer does.
  const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  expect((await anon().auth.signInWithPassword({ email: user.email, password: NEW })).error).toBeNull();
  expect((await anon().auth.signInWithPassword({ email: user.email, password: user.password })).error).not.toBeNull();
  await page.context().close();
});

test("institution: a wrong code is refused, a real code joins the institution and shows the membership", async ({ browser }) => {
  const { data: plan } = await db().from("plans").select("id").eq("slug", "premium").single();
  const { data: institution, error } = await db().from("institutions").insert({ name: `E2E Settings Institution ${RUN}`, slug: `e2e-settings-${RUN}` }).select("id").single();
  if (error || !institution) throw new Error(error?.message);
  institutionId = institution.id;
  await db().from("institution_licences").insert({ institution_id: institutionId, plan_id: plan!.id, seat_count: 5 });
  const code = `E2E-SET-${RUN}`.toUpperCase();
  codes.push(code);
  await db().from("access_codes").insert({ code, label: "e2e", institution_id: institutionId, max_redemptions: 3 });

  const page = await openAs(browser, session);
  await tab(page, "Institution");
  await page.getByLabel("Institution access code").fill("NOT-A-REAL-CODE");
  await page.getByRole("button", { name: "Redeem" }).click();
  await expect(page.getByText(/invalid|expired|not valid|couldn.t/i).first()).toBeVisible();
  expect((await db().from("institution_members").select("id").eq("user_id", user.id)).data).toHaveLength(0);

  await page.getByLabel("Institution access code").fill(code);
  await page.getByRole("button", { name: "Redeem" }).click();
  await expect(page.getByText(`E2E Settings Institution ${RUN}`)).toBeVisible({ timeout: 20_000 });
  const { data } = await db().from("institution_members").select("role").eq("user_id", user.id).eq("institution_id", institutionId);
  expect(data).toEqual([{ role: "member" }]);
  expect((await db().from("access_codes").select("redemption_count").eq("code", code).single()).data!.redemption_count).toBe(1);
  await page.context().close();
});

test("every settings section fits a phone", async ({ browser }) => {
  const page = await openAs(browser, session, { width: 390, height: 800 });
  for (const name of ["Notifications", "Career", "Account", "Institution"]) {
    await tab(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), name).toBeLessThanOrEqual(1);
  }
  await page.context().close();
});
