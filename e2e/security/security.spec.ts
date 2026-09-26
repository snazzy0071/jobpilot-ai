import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner } from "../support/cv-fixture";
import { EXPORT_TABLES } from "../../src/lib/settings/export-tables";

// Security and GDPR checks against the real database and a production build. Each block is a defect that existed and was fixed, or a
// property that must keep holding: anonymous write paths closed, open redirects, re-authentication for account takeover and deletion,
// a complete account export, erasure of everything keyed by the email address, and the security headers.

test.describe.configure({ mode: "serial", timeout: 120_000 });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const RUN = Date.now().toString(36);
const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const users: IsolatedUser[] = [];

async function newUser(name: string): Promise<IsolatedUser> {
  const user = await createIsolatedUser({ fullName: name });
  await markOnboarded(user.id);
  users.push(user);
  return user;
}

async function loginPage(browser: Browser, user: IsolatedUser): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1360, height: 900 } });
  const page = await context.newPage();
  await page.goto("/login");
  await dismissCookieBanner(page);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
  return page;
}

test.afterAll(async () => {
  for (const user of users) await deleteIsolatedUser(user.id);
});

test.describe("anonymous access is closed", () => {
  test("the public key cannot insert leads directly (the form actions' rate limits cannot be skipped)", async () => {
    const client = anon();
    const attempts = [
      await client.from("contact_messages").insert({ name: "x", email: `spam-${RUN}@example.test`, subject: "s", message: "direct insert" }),
      await client.from("demo_requests").insert({ institution_name: "x", contact_name: "x", email: `spam-${RUN}@example.test` }),
      await client.from("partner_inquiries").insert({ organisation_name: "x", contact_name: "x", email: `spam-${RUN}@example.test`, message: "x" }),
      await client.from("newsletter_subscribers").insert({ email: `spam-${RUN}@example.test`, consent_source: "e2e" }),
    ];
    for (const attempt of attempts) expect(attempt.error).not.toBeNull();
    for (const table of ["contact_messages", "demo_requests", "partner_inquiries", "newsletter_subscribers"]) {
      expect((await db().from(table).select("id").eq("email", `spam-${RUN}@example.test`)).data ?? []).toHaveLength(0);
    }
  });

  test("the public key cannot call service-role-only functions", async () => {
    const client = anon();
    const zero = "00000000-0000-0000-0000-000000000000";
    const calls: [string, Record<string, unknown>][] = [
      ["release_usage", { p_user_id: zero, p_metric: "x", p_period_start: "2026-01-01T00:00:00Z", p_amount: 1 }],
      ["try_consume_usage", { p_user_id: zero, p_metric: "x", p_period_start: "2026-01-01T00:00:00Z", p_period_end: "2026-02-01T00:00:00Z", p_limit: 1, p_amount: 1 }],
      ["increment_subscription_usage", { p_user_id: zero, p_metric: "x", p_period_start: "2026-01-01T00:00:00Z", p_period_end: "2026-02-01T00:00:00Z", p_amount: 1 }],
      ["redeem_access_code", { p_code: "x", p_user_id: zero }],
      ["accept_institution_invite", { p_token_hash: "x", p_user_id: zero }],
      ["enroll_via_verified_domain", { p_user_id: zero }],
      ["get_institution_analytics", { p_institution_id: zero }],
      ["get_institution_licence_plan", { p_user_id: zero }],
      ["admin_overview_snapshot", {}],
      ["admin_subscription_breakdown", {}],
      ["admin_auto_apply_overview", {}],
    ];
    for (const [fn, args] of calls) expect((await client.rpc(fn, args)).error?.message, fn).toMatch(/permission denied|could not find/i);
  });

  test("every table that holds a user's data returns nothing to the public key", async () => {
    const client = anon();
    for (const { table } of EXPORT_TABLES) {
      const { data, error } = await client.from(table).select("*").limit(5);
      expect(error === null ? data : [], table).toEqual([]);
    }
    // The test-prep answer key is not readable either.
    expect((await client.from("questions").select("correct_answer").limit(1)).error).not.toBeNull();
  });
});

test.describe("redirects, headers and uploads", () => {
  let user: IsolatedUser;

  test("a signed-in visitor is never redirected off-site through ?redirect= (backslash and control-character tricks included)", async ({ browser }) => {
    user = await newUser("Redirect Tester");
    const page = await loginPage(browser, user);
    for (const hostile of ["//evil.example", "/\\evil.example", "/%09/evil.example", "/\t/evil.example", "https://evil.example", "/%5Cevil.example"]) {
      await page.goto(`/login?redirect=${encodeURIComponent(hostile)}`);
      expect(new URL(page.url()).origin, hostile).toBe(new URL(BASE_URL).origin);
    }
    await page.context().close();
  });

  test("security headers are on pages, on 404s and on API responses", async ({ request }) => {
    for (const path of ["/", "/pricing", "/no-such-page-" + RUN, "/api/quick-scan/not-a-token/pdf"]) {
      const response = await request.get(`${BASE_URL}${path}`, { maxRedirects: 0 });
      const headers = response.headers();
      expect(headers["content-security-policy"], path).toContain("default-src 'self'");
      expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(headers["content-security-policy"], path).toContain("object-src 'none'");
      expect(headers["x-frame-options"], path).toBe("DENY");
      expect(headers["x-content-type-options"], path).toBe("nosniff");
      expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(headers["strict-transport-security"], path).toContain("max-age=");
      expect(headers["permissions-policy"], path).toContain("camera=()");
      expect(headers["x-powered-by"], path).toBeUndefined();
    }
  });

  test("uploads: anonymous and cross-origin requests are refused, and an oversized declared body is refused before it is read", async ({ browser, request }) => {
    const anonymous = await request.post(`${BASE_URL}/api/files/parse`, { multipart: { file: { name: "cv.txt", mimeType: "text/plain", buffer: Buffer.from("hello") } }, maxRedirects: 0 });
    expect([401, 403, 302, 307]).toContain(anonymous.status());

    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    await page.goto("/login");
    await dismissCookieBanner(page);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    const crossOrigin = await context.request.post(`${BASE_URL}/api/files/parse`, { headers: { origin: "https://evil.example" }, multipart: { file: { name: "cv.txt", mimeType: "text/plain", buffer: Buffer.from("hello") } } });
    expect(crossOrigin.status()).toBe(403);
    const huge = await context.request.post(`${BASE_URL}/api/files/parse`, { headers: { origin: BASE_URL, "content-type": "multipart/form-data; boundary=x", "content-length": String(50 * 1024 * 1024) }, data: "x" }).catch(() => null);
    if (huge) expect([413, 400, 500]).toContain(huge.status());
    // A real text upload from the same origin still works.
    const ok = await context.request.post(`${BASE_URL}/api/files/parse`, { headers: { origin: BASE_URL }, multipart: { file: { name: "cv.txt", mimeType: "text/plain", buffer: Buffer.from("Jane Doe, Software Engineer, London. Built things with TypeScript.") } } });
    expect(ok.status()).toBe(200);
    await context.close();
  });
});

test.describe("account export is complete and private", () => {
  let a: IsolatedUser;
  let b: IsolatedUser;

  test("seed two accounts with data in many tables", async () => {
    a = await newUser("Export A");
    b = await newUser("Export B");
    for (const [u, tag] of [[a, "A"], [b, "B"]] as const) {
      const cv = await seedCv(u.id, { title: `EXPORT-CV-${tag}-${RUN}` });
      expect((await db().from("cover_letters").insert({ user_id: u.id, job_description: "A job description for the export test.", company_name: `EXPORT-LETTER-${tag}-${RUN}`, job_title: "Role" })).error).toBeNull();
      await db().from("applications").insert({ user_id: u.id, company_name: "Co", job_title: `EXPORT-APP-${tag}-${RUN}`, status: "applied", notes: `EXPORT-NOTE-${tag}-${RUN}` });
      await db().from("interview_sessions").insert({ user_id: u.id, role: `EXPORT-INTERVIEW-${tag}-${RUN}`, status: "completed", completed_at: new Date().toISOString() });
      await db().from("ats_scans").insert({ user_id: u.id, source: "cv_version", cv_version_id: cv.versionId, cv_text_snapshot: "cv", job_description: "x".repeat(40), match_score: 70, keyword_score: 70, structure_score: 70, format_score: 70, sections_score: 70, summary: `EXPORT-SCAN-${tag}-${RUN}`, prompt_version: "test" });
      await db().from("auto_apply_settings").insert({ user_id: u.id });
      expect((await db().from("newsletter_subscribers").insert({ email: u.email.toLowerCase(), consent_source: "newsletter_page" })).error).toBeNull();
      expect((await db().from("contact_messages").insert({ name: `EXPORT-${tag}`, email: u.email.toLowerCase(), subject: "s", message: `EXPORT-MSG-${tag}-${RUN}` })).error).toBeNull();
      expect((await db().from("email_send_logs").insert({ recipient: u.email.toLowerCase(), template: `export-${tag}`, status: "sent", attempts: 1 })).error).toBeNull();
    }
  });

  test("the JSON export contains every category of the account's own data, and none of anyone else's", async ({ browser }) => {
    const page = await loginPage(browser, a);
    const response = await page.context().request.get(`${BASE_URL}/dashboard/settings/export`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("attachment");
    const payload = await response.json();
    const text = JSON.stringify(payload);

    // Every table the schema stores against a user id is present as a key, so nothing is silently left out.
    for (const { table } of EXPORT_TABLES) expect(payload.data, table).toHaveProperty(table);
    expect(payload.notIncluded.map((entry: { table: string }) => entry.table)).toContain("ai_rate_limit_windows");
    expect(payload.account).toMatchObject({ id: a.id, email: a.email });

    for (const marker of [`EXPORT-CV-A-${RUN}`, `EXPORT-LETTER-A-${RUN}`, `EXPORT-APP-A-${RUN}`, `EXPORT-NOTE-A-${RUN}`, `EXPORT-INTERVIEW-A-${RUN}`, `EXPORT-SCAN-A-${RUN}`, `EXPORT-MSG-A-${RUN}`]) expect(text, marker).toContain(marker);
    expect(payload.data.cvs).toHaveLength(1);
    expect(payload.data.cover_letters).toHaveLength(1);
    expect(payload.data.interview_sessions).toHaveLength(1);
    expect(payload.data.auto_apply_settings).toHaveLength(1);
    expect(payload.emailKeyed.newsletterSubscription).toHaveLength(1);
    expect(payload.emailKeyed.emailsSent.length).toBeGreaterThan(0);
    expect(text).not.toContain(`-B-${RUN}`);
    expect(text).not.toContain(b.email);
    await page.context().close();
  });

  test("the ZIP export has one file per category with the same content, and the export is recorded", async ({ browser }) => {
    const page = await loginPage(browser, a);
    const response = await page.context().request.get(`${BASE_URL}/dashboard/settings/export?format=zip`);
    expect(response.status()).toBe(200);
    const zip = await JSZip.loadAsync(await response.body());
    const names = Object.keys(zip.files);
    for (const { table } of EXPORT_TABLES) expect(names, table).toContain(`${table}.json`);
    expect(names).toEqual(expect.arrayContaining(["account-and-profile.json", "email-keyed-records.json", "account-access-by-support.json"]));
    expect(await zip.file("cvs.json")!.async("string")).toContain(`EXPORT-CV-A-${RUN}`);
    expect((await db().from("data_export_logs").select("format").eq("user_id", a.id)).data?.map((row) => row.format).sort()).toEqual(["json", "zip"]);
    await page.context().close();
  });

  test("a signed-out request gets no export", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/dashboard/settings/export`, { maxRedirects: 0 });
    expect([302, 307, 401, 403]).toContain(response.status());
    expect(await response.text()).not.toContain(`EXPORT-CV-A-${RUN}`);
  });
});

test.describe("re-authentication, deletion and erasure", () => {
  let user: IsolatedUser;

  test("changing the password or the email, or deleting the account, needs the current password", async ({ browser }) => {
    user = await newUser("Reauth Tester");
    const page = await loginPage(browser, user);
    await page.goto("/dashboard/settings?tab=account");
    await dismissCookieBanner(page);

    // Password change without / with the wrong current password.
    const newPassword = `Changed-${RUN}-Pw1!`;
    await page.locator("#password").fill(newPassword);
    await page.locator("#confirmPassword").fill(newPassword);
    await page.locator("#currentPasswordForPassword").fill("wrong-password");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("That isn't your current password.")).toBeVisible();

    // Email change with the wrong password.
    await page.locator("#email").fill(`moved-${RUN}@e2e.jobpilotai.test`);
    await page.locator("#currentPasswordForEmail").fill("wrong-password");
    await page.getByRole("button", { name: "Update email" }).click();
    await expect(page.getByText("That isn't your current password.").nth(1)).toBeVisible();
    expect((await db().auth.admin.getUserById(user.id)).data.user?.email).toBe(user.email.toLowerCase());

    // Password change with the right one works, and only then.
    // (React clears a form after each submit, so the fields are filled in again.)
    await page.locator("#password").fill(newPassword);
    await page.locator("#confirmPassword").fill(newPassword);
    await page.locator("#currentPasswordForPassword").fill(user.password);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Password updated.")).toBeVisible();
    user.password = newPassword;

    // Deleting: refused without the password, account intact.
    await page.goto("/dashboard/settings?tab=privacy");
    await page.locator("#confirmation").fill("DELETE");
    await page.locator("#currentPasswordForDelete").fill("wrong-password");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByText("That isn't your current password.")).toBeVisible();
    expect((await db().auth.admin.getUserById(user.id)).data.user).not.toBeNull();
    await page.context().close();
  });

  test("erasure removes the account, everything it owns, and the records kept against its email address", async ({ browser }) => {
    const victim = await newUser("Erase Me");
    const email = victim.email.toLowerCase();
    const cv = await seedCv(victim.id, { title: `ERASE-CV-${RUN}` });
    await db().from("interview_sessions").insert({ user_id: victim.id, role: "ERASE-ROLE", status: "completed", completed_at: new Date().toISOString() });
    for (const result of [await db().from("newsletter_subscribers").insert({ email, consent_source: "newsletter_page" }), await db().from("contact_messages").insert({ name: "Erase", email, subject: "s", message: "m" }), await db().from("email_send_logs").insert({ recipient: email, template: "erase-test", status: "sent", attempts: 1 })]) expect(result.error).toBeNull();
    // Someone else's rows with a look-alike address must survive.
    const other = `x${email}`;
    expect((await db().from("newsletter_subscribers").insert({ email: other, consent_source: "quick_scan" })).error).toBeNull();

    const page = await loginPage(browser, victim);
    await page.goto("/dashboard/settings?tab=privacy");
    await dismissCookieBanner(page);
    await page.locator("#confirmation").fill("DELETE");
    await page.locator("#currentPasswordForDelete").fill(victim.password);
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/dashboard"), { timeout: 60_000 });

    expect((await db().auth.admin.getUserById(victim.id)).data.user).toBeNull();
    expect((await db().from("cvs").select("id").eq("id", cv.cvId)).data).toHaveLength(0);
    expect((await db().from("interview_sessions").select("id").eq("user_id", victim.id)).data).toHaveLength(0);
    expect((await db().from("profiles").select("id").eq("id", victim.id)).data).toHaveLength(0);
    for (const [table, column] of [["newsletter_subscribers", "email"], ["contact_messages", "email"]] as const) {
      expect((await db().from(table).select("id").eq(column, email)).data, table).toHaveLength(0);
    }
    // The address's send log is cleared after the confirmation email; nothing about the address remains except that confirmation, which is also removed.
    await expect.poll(async () => (await db().from("email_send_logs").select("id").eq("recipient", email).neq("template", "account_deleted")).data?.length).toBe(0);
    expect((await db().from("newsletter_subscribers").select("id").eq("email", other)).data).toHaveLength(1);
    await db().from("newsletter_subscribers").delete().eq("email", other);
    await page.context().close().catch(() => undefined);
  });
});
