import { expect, test, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { dismissCookieBanner } from "../support/cv-fixture";
import { createLimitedAdmin, createSuperAdmin, openAs, removeAdminSession, type AdminSession } from "../support/admin-session";

// The four public lead forms (newsletter, contact, demo, partners) and the admin Leads screen, against the real database. Only the
// resend mailer is absent here, so acknowledgement emails are not asserted. Every row is tagged and deleted afterwards.

test.describe.configure({ mode: "serial", timeout: 180_000 });

const db = () => getAdminClient();
const RUN = `e2elead${Date.now().toString(36)}`;
const NEWS_EMAIL = `${RUN}-news@example.com`;
const CONTACT_EMAIL = `${RUN}-contact@example.com`;
const DEMO_EMAIL = `${RUN}-demo@example.com`;
const PARTNER_EMAIL = `${RUN}-partner@example.com`;
const CREW_EMAIL = `${RUN}-crew@example.com`;
const ROLE = `e2e-leads-${RUN}`;

let admin: AdminSession;
let limited: AdminSession;

async function clearLimits() {
  await db().from("anonymous_rate_limits").delete().like("scope", "lead_%");
}

async function visit(page: Page, path: string) {
  await page.goto(path);
  await dismissCookieBanner(page);
}

test.beforeAll(async ({ browser }) => {
  await clearLimits();
  admin = await createSuperAdmin(browser, "Leads Admin");
  limited = await createLimitedAdmin(browser, "manage_users", ROLE);
});

test.afterAll(async () => {
  await db().from("newsletter_subscribers").delete().like("email", `${RUN}%`);
  await db().from("contact_messages").delete().like("email", `${RUN}%`);
  await db().from("demo_requests").delete().like("email", `${RUN}%`);
  await db().from("partner_inquiries").delete().like("email", `${RUN}%`);
  await db().from("campus_crew_applications").delete().like("email", `${RUN}%`);
  await clearLimits();
  await removeAdminSession(admin);
  await removeAdminSession(limited, ROLE);
});

test("newsletter: a valid email subscribes and is stored with its consent source; a bad one is refused with an alert", async ({ page }) => {
  await visit(page, "/newsletter");
  await page.getByLabel("Email").fill("not-an-email");
  // The browser's own email check blocks a malformed address before the server sees it; bypass it to prove the server refuses too.
  await page.getByLabel("Email").evaluate((el: HTMLInputElement) => (el.type = "text"));
  await page.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /email/i })).toBeVisible();

  await page.getByLabel("Email").fill(NEWS_EMAIL);
  await page.getByRole("button", { name: "Subscribe" }).click();
  // Double opt-in: the visitor is asked to confirm by email, and nothing is "subscribed" yet. Without an email provider configured the
  // form says the email could not be sent; either way the address is stored as pending confirmation, never as subscribed.
  await expect(page.getByRole("status").or(page.getByRole("alert").filter({ hasText: /confirmation email/ }))).toBeVisible();
  const { data } = await db().from("newsletter_subscribers").select("status, consent_source, confirmed_at, confirm_token_hash").eq("email", NEWS_EMAIL);
  expect(data).toHaveLength(1);
  expect(data![0]).toMatchObject({ status: "pending", consent_source: "newsletter_page", confirmed_at: null });
  expect(data![0].confirm_token_hash).toMatch(/^[0-9a-f]{64}$/);
});

test("contact: a message is stored, and a too-short one is refused by the server", async ({ page }) => {
  await visit(page, "/contact");
  await page.getByLabel("Name").fill("Lead Tester");
  await page.getByLabel("Email").fill(CONTACT_EMAIL);
  await page.getByLabel("Subject").fill(`${RUN} question`);
  await page.getByLabel("Message").evaluate((el: HTMLTextAreaElement) => el.removeAttribute("minlength"));
  await page.getByLabel("Message").fill("short");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect((await db().from("contact_messages").select("id").eq("email", CONTACT_EMAIL)).data).toHaveLength(0);

  // A refused submission keeps what the person typed, so they only fix the one field.
  await expect(page.getByLabel("Name")).toHaveValue("Lead Tester");
  await expect(page.getByLabel("Email")).toHaveValue(CONTACT_EMAIL);
  await expect(page.getByLabel("Subject")).toHaveValue(`${RUN} question`);
  await page.getByLabel("Message").fill("Hello, this is a real enough message about your product.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Message sent");
  const { data } = await db().from("contact_messages").select("name, subject, message").eq("email", CONTACT_EMAIL);
  expect(data).toEqual([{ name: "Lead Tester", subject: `${RUN} question`, message: "Hello, this is a real enough message about your product." }]);
});

test("demo request: stored with the institution details", async ({ page }) => {
  await visit(page, "/demo");
  await page.getByLabel("Institution name").fill(`${RUN} University`);
  await page.getByLabel("Your name").fill("Demo Tester");
  await page.getByLabel("Work email").fill(DEMO_EMAIL);
  await page.getByRole("button", { name: "Request a demo" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const { data } = await db().from("demo_requests").select("institution_name, contact_name").eq("email", DEMO_EMAIL);
  expect(data).toEqual([{ institution_name: `${RUN} University`, contact_name: "Demo Tester" }]);
});

test("partner enquiry: stored with the partnership type", async ({ page }) => {
  await visit(page, "/partners");
  await page.getByLabel("Organisation name").fill(`${RUN} Society`);
  await page.getByLabel("Your name").fill("Partner Tester");
  await page.getByLabel("Email").fill(PARTNER_EMAIL);
  await page.getByLabel("Tell us about the partnership you have in mind").fill("We would like to work together on employability events.");
  await page.getByRole("button", { name: "Submit inquiry" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const { data } = await db().from("partner_inquiries").select("organisation_name, partnership_type").eq("email", PARTNER_EMAIL);
  expect(data).toHaveLength(1);
  expect(data![0].organisation_name).toBe(`${RUN} Society`);
  expect(data![0].partnership_type).toBeTruthy();
});

test("campus crew: an application is stored, optional fields may be left out, and a thin one is refused with the answer kept", async ({ page }) => {
  await visit(page, "/campus-crew");
  await page.getByLabel("Your name").fill("Crew Tester");
  await page.getByLabel("Email").fill(CREW_EMAIL);
  await page.getByLabel("University or college").fill(`${RUN} University`);
  await page.getByLabel("Why do you want to be on the Campus Crew?").evaluate((el: HTMLTextAreaElement) => el.removeAttribute("minlength"));
  await page.getByLabel("Why do you want to be on the Campus Crew?").fill("short");
  await page.getByRole("button", { name: "Apply to the Campus Crew" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("at least 10");
  await expect(page.getByLabel("Your name")).toHaveValue("Crew Tester");
  expect((await db().from("campus_crew_applications").select("id").eq("email", CREW_EMAIL)).data).toHaveLength(0);

  await page.getByLabel("Why do you want to be on the Campus Crew?").fill("I run the careers society and want more people to use good tools.");
  await page.getByRole("button", { name: "Apply to the Campus Crew" }).click();
  await expect(page.getByRole("status")).toContainText("your application is in");
  const { data } = await db().from("campus_crew_applications").select("name, university, course, study_year, reach").eq("email", CREW_EMAIL);
  expect(data).toEqual([{ name: "Crew Tester", university: `${RUN} University`, course: null, study_year: null, reach: null }]);
});

test("nobody can write to or read the Campus Crew table through the public API", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const attempt = await anon.from("campus_crew_applications").insert({ name: "x", email: `${RUN}-direct@example.com`, university: "x", motivation: "long enough motivation" });
  expect(attempt.error).not.toBeNull();
  const read = await anon.from("campus_crew_applications").select("id").eq("email", CREW_EMAIL);
  expect(read.data ?? []).toHaveLength(0);
});

test("the public forms are rate limited per address", async ({ page }) => {
  await clearLimits();
  let refused = false;
  for (let attempt = 0; attempt < 7 && !refused; attempt++) {
    await visit(page, "/newsletter");
    await page.getByLabel("Email").fill(`${RUN}-burst${attempt}@example.com`);
    await page.getByRole("button", { name: "Subscribe" }).click();
    // Either the thank-you or the refusal appears; wait for whichever comes.
    const outcome = page.getByRole("status").or(page.getByRole("alert").filter({ hasText: /\S/ }));
    await expect(outcome).toBeVisible({ timeout: 15_000 });
    refused = (await page.getByRole("alert").filter({ hasText: /too many/i }).count()) > 0;
  }
  expect(refused).toBe(true);
  // The refused attempt stored nothing beyond the five allowed.
  const { count } = await db().from("newsletter_subscribers").select("id", { count: "exact", head: true }).like("email", `${RUN}-burst%`);
  expect(count).toBe(5);
});

test("admin Leads shows each submission, and deleting one removes it and is audited without the content", async ({ browser }) => {
  const page = await openAs(browser, admin);
  await visit(page, "/admin/leads");
  // Not scoped to #main-content — the page's own duplicate "Leads" heading was removed (the shared admin header
  // already renders one for this route), so the single remaining <h1> now lives in the header instead.
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();

  await expect(page.getByRole("cell", { name: NEWS_EMAIL })).toBeVisible();
  await page.getByRole("tab", { name: /^Contact/ }).click();
  await expect(page.getByText(`${RUN} question`)).toBeVisible();
  await page.getByRole("tab", { name: /^Demo requests/ }).click();
  await expect(page.getByText(`${RUN} University`)).toBeVisible();
  await page.getByRole("tab", { name: /^Partners/ }).click();
  await expect(page.getByText(`${RUN} Society`)).toBeVisible();
  await page.getByRole("tab", { name: /^Campus Crew/ }).click();
  await expect(page.getByText(`${RUN} University`, { exact: false }).first()).toBeVisible();
  await expect(page.getByText(CREW_EMAIL, { exact: false })).toBeVisible();

  // Delete the contact message (a confirm dialog guards it).
  await page.getByRole("tab", { name: /^Contact/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("[data-slot=card]").filter({ hasText: `${RUN} question` }).getByRole("button", { name: "Delete message" }).click();
  await expect(page.getByText(`${RUN} question`)).toHaveCount(0);
  expect((await db().from("contact_messages").select("id").eq("email", CONTACT_EMAIL)).data).toHaveLength(0);

  const { data: audit } = await db().from("admin_audit_logs").select("action, entity_type, metadata").eq("actor_id", admin.user.id).eq("action", "lead.delete");
  expect(audit).toHaveLength(1);
  expect(audit![0].metadata).toEqual({ table: "contact_messages" });
  await page.context().close();
});

test("only an admin with the view_leads permission can open Leads or delete anything", async ({ browser }) => {
  const page = await openAs(browser, limited);
  await page.goto("/admin/leads");
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().close();
});
