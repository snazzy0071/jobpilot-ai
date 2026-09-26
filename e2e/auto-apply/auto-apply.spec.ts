import { expect, test as base, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser } from "../support/test-user";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest } from "../support/cv-fixture";

// Assisted Auto-Apply against the REAL database. No submitting adapter exists (no job source offers an apply API), so every approved
// application ends in "Apply yourself" and is logged to the tracker only when the user confirms. Serial: later steps build on earlier
// ones. Seeded jobs use the "E2EAA" prefix and are removed afterwards; the account (and everything it owns) is deleted by the fixture.

const test = makeCvTest({ name: "AutoApply Tester", plan: "premium" });
const db = () => getAdminClient();
test.describe.configure({ mode: "serial" });

const PAGE = "/dashboard/auto-apply";
const item = (page: Page, text: string) => page.locator("[data-queue-item]").filter({ hasText: text });

async function go(page: Page, url = PAGE) {
  await page.goto(url);
  await dismissCookieBanner(page);
}

async function queueRows(userId: string) {
  const { data } = await db().from("auto_apply_queue").select("*").eq("user_id", userId).order("created_at");
  return data ?? [];
}

async function events(userId: string) {
  const { data } = await db().from("auto_apply_events").select("event").eq("user_id", userId);
  return (data ?? []).map((row) => row.event as string);
}

const jobIds: string[] = [];
let cvId = "";

base.describe("plan gate", () => {
  base("a free account sees the locked page, with no settings or queue to work with", async ({ browser }) => {
    const user = await createIsolatedUser({ fullName: "Free AutoApply" });
    await markOnboarded(user.id);
    try {
      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });
      const page = await context.newPage();
      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill(user.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/dashboard$/);
      await page.goto(PAGE);
      await expect(page.getByTestId("auto-apply-locked")).toBeVisible();
      await expect(page.getByRole("button", { name: "Find matching jobs" })).toHaveCount(0);
      await context.close();
    } finally {
      await deleteIsolatedUser(user.id);
    }
  });
});

test.describe("auto-apply", () => {
  test.afterAll(async () => {
    if (jobIds.length > 0) await db().from("jobs").delete().in("id", jobIds); // job_matches cascade
  });

  test("seed jobs and scores", async ({ account }) => {
    const cv = await seedCv(account.user.id, { title: "AA CV", fullName: "AA Person" });
    cvId = cv.cvId;
    const { data: source } = await db().from("job_sources").select("id").eq("slug", "manual").single();
    const specs = [
      { title: "E2EAA Analyst One", company: "Rolls-Royce plc", location: "London", score: 90 },
      { title: "E2EAA Analyst Leeds", company: "Acme Health Ltd", location: "Leeds", score: 90 },
      { title: "E2EAA Analyst Low", company: "Acme Consulting", location: "London", score: 60 },
      { title: "E2EAA Analyst Unscored", company: "Beta Ltd", location: "London", score: null },
    ];
    for (const spec of specs) {
      const { data: job, error } = await db()
        .from("jobs")
        .insert({ source_id: source!.id, title: spec.title, title_normalized: spec.title.toLowerCase(), company_name: spec.company, company_name_normalized: spec.company.toLowerCase(), location: spec.location, description: "e2e", url: `https://example.test/${spec.title.replace(/ /g, "-")}`, posted_at: new Date().toISOString() })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      jobIds.push(job!.id);
      if (spec.score !== null) {
        const { error: matchError } = await db().from("job_matches").insert({
          user_id: account.user.id, job_id: job!.id, cv_version_id: cv.versionId, match_score: spec.score, verdict: "worth_applying", reasons: ["r"], gaps: [], prompt_version: "e2e",
          core_skills_score: 70, core_skills_summary: "s", tech_functional_skills_score: 70, tech_functional_skills_summary: "s", domain_fit_score: 70, domain_fit_summary: "s", seniority_score: 70, seniority_summary: "s",
        });
        if (matchError) throw new Error(matchError.message);
      }
    }
  });

  test("turning it on needs a CV and your consent; a valid save is stored and audited", async ({ open, account }) => {
    const page = await open();
    await go(page);
    await page.getByLabel("Role keywords").fill("e2eaa analyst");
    await page.getByLabel("Auto-Apply is on").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Choose the CV to apply with before turning Auto-Apply on.")).toBeVisible();

    await page.getByLabel("CV to apply with").selectOption({ label: "AA CV" });
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Please confirm you understand how Auto-Apply works before turning it on.")).toBeVisible();

    await page.getByLabel(/I understand that JobPilot only prepares/).check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();

    const { data: saved } = await db().from("auto_apply_settings").select("*").eq("user_id", account.user.id).single();
    expect(saved).toMatchObject({ enabled: true, cv_id: cvId, min_match_score: 75, role_keywords: ["e2eaa analyst"] });
    expect(saved!.consent_at).not.toBeNull();
    const seen = await events(account.user.id);
    expect(seen).toEqual(expect.arrayContaining(["consent_given", "enabled", "settings_changed"]));
  });

  test("finding matches applies the threshold, roles and unscored rules", async ({ open, account }) => {
    const page = await open();
    await go(page);
    await page.getByRole("button", { name: "Find matching jobs" }).click();
    await expect(page.getByText(/added 2 for review/)).toBeVisible();
    await expect(item(page, "E2EAA Analyst One")).toBeVisible();
    await expect(item(page, "E2EAA Analyst Leeds")).toBeVisible();
    await expect(item(page, "E2EAA Analyst Low")).toHaveCount(0);
    await expect(item(page, "E2EAA Analyst Unscored")).toHaveCount(0);
    expect((await queueRows(account.user.id)).map((row) => row.status)).toEqual(["pending_review", "pending_review"]);
  });

  test("running the search again never queues the same job twice", async ({ open, account }) => {
    const page = await open();
    await go(page);
    await page.getByRole("button", { name: "Find matching jobs" }).click();
    await expect(page.getByText(/added 0 for review, 2 already handled/)).toBeVisible();
    expect(await queueRows(account.user.id)).toHaveLength(2);
  });

  test("sponsor-only leaves out employers that aren't confirmed sponsors; applied-in-tracker jobs are never re-queued", async ({ open, account }) => {
    await db().from("auto_apply_queue").delete().eq("user_id", account.user.id);
    await db().from("auto_apply_settings").update({ sponsor_only: true }).eq("user_id", account.user.id);
    const page = await open();
    await go(page);
    await page.getByRole("button", { name: "Find matching jobs" }).click();
    await expect(page.getByText(/added 1 for review/)).toBeVisible();
    await expect(item(page, "E2EAA Analyst One")).toBeVisible();
    await expect(item(page, "E2EAA Analyst Leeds")).toHaveCount(0);

    // Already applied for through the tracker (a different feed's copy of the same employer + title).
    await db().from("auto_apply_queue").delete().eq("user_id", account.user.id);
    await db().from("applications").insert({ user_id: account.user.id, company_name: "Rolls-Royce plc", job_title: "E2EAA Analyst One", status: "applied", applied_at: new Date().toISOString().slice(0, 10) });
    await page.getByRole("button", { name: "Find matching jobs" }).click();
    await expect(page.getByText(/added 0 for review, 1 already handled/)).toBeVisible();
    await db().from("applications").delete().eq("user_id", account.user.id);
    await db().from("auto_apply_settings").update({ sponsor_only: false }).eq("user_id", account.user.id);
  });

  test("approve → apply yourself → confirm: logged in the tracker, linked to the job, fully audited", async ({ open, account }) => {
    test.setTimeout(120_000);
    const page = await open();
    await go(page);
    await page.getByRole("button", { name: "Find matching jobs" }).click();
    await expect(item(page, "E2EAA Analyst One")).toBeVisible();

    await item(page, "E2EAA Analyst One").getByRole("button", { name: "Approve" }).click();
    const manual = page.getByRole("region", { name: "Apply yourself" }).locator("[data-queue-item]").filter({ hasText: "E2EAA Analyst One" });
    await expect(manual).toBeVisible();
    await expect(manual.getByRole("link", { name: /Open the application/ })).toHaveAttribute("href", /example\.test/);

    // Nothing has been logged as applied yet: only the user's confirmation does that.
    expect((await db().from("applications").select("id").eq("user_id", account.user.id)).data).toHaveLength(0);

    await manual.getByRole("button", { name: "I've applied" }).click();
    await expect(page.getByRole("region", { name: "Applied" }).locator("[data-queue-item]").filter({ hasText: "E2EAA Analyst One" })).toBeVisible({ timeout: 40_000 }); // freezing the CV copy makes this step slow

    const { data: apps } = await db().from("applications").select("id, status, job_id, cover_letter_id").eq("user_id", account.user.id);
    expect(apps).toHaveLength(1);
    expect(apps![0]).toMatchObject({ status: "applied", job_id: jobIds[0] });
    const row = (await queueRows(account.user.id)).find((r) => r.job_title === "E2EAA Analyst One");
    expect(row).toMatchObject({ status: "applied", application_id: apps![0].id, adapter: "assisted" });
    expect(await events(account.user.id)).toEqual(expect.arrayContaining(["queued", "approved", "handed_to_manual", "applied_confirmed"]));
    await expect(page.getByTestId("auto-apply-history")).toContainText("You confirmed you applied");
  });

  test("the daily limit refuses further approvals", async ({ open, account }) => {
    await db().from("auto_apply_settings").update({ daily_limit: 1 }).eq("user_id", account.user.id);
    const page = await open();
    await go(page);
    await item(page, "E2EAA Analyst Leeds").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(/reached today's limit of 1/)).toBeVisible();
    expect((await queueRows(account.user.id)).find((r) => r.job_title === "E2EAA Analyst Leeds")?.status).toBe("pending_review");
    await db().from("auto_apply_settings").update({ daily_limit: 5 }).eq("user_id", account.user.id);
  });

  test("pause blocks finding and approving; resume restores them", async ({ open, account }) => {
    const page = await open();
    await go(page);
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByText("Auto-Apply is paused.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Find matching jobs" })).toBeDisabled();
    await expect(item(page, "E2EAA Analyst Leeds").getByRole("button", { name: "Approve" })).toBeDisabled();
    expect((await db().from("auto_apply_settings").select("paused").eq("user_id", account.user.id).single()).data?.paused).toBe(true);

    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("button", { name: "Find matching jobs" })).toBeEnabled();
    expect(await events(account.user.id)).toEqual(expect.arrayContaining(["paused", "resumed"]));
  });

  test("skipping removes it from review", async ({ open, account }) => {
    const page = await open();
    await go(page);
    await item(page, "E2EAA Analyst Leeds").getByRole("button", { name: "Skip" }).click();
    await expect(page.getByRole("region", { name: "Closed" }).locator("[data-queue-item]").filter({ hasText: "E2EAA Analyst Leeds" })).toBeVisible();
    expect((await queueRows(account.user.id)).find((r) => r.job_title === "E2EAA Analyst Leeds")?.status).toBe("skipped");
  });

  test("RLS: the account can read its own rows but cannot write settings, the queue or the audit log itself", async ({ account }) => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error: signInError } = await anon.auth.signInWithPassword({ email: account.user.email, password: account.user.password });
    expect(signInError).toBeNull();

    expect((await anon.from("auto_apply_queue").select("id")).data?.length).toBeGreaterThan(0);
    const uid = account.user.id;
    const attempts = [
      await anon.from("auto_apply_settings").update({ daily_limit: 25 }).eq("user_id", uid).select(),
      await anon.from("auto_apply_queue").update({ status: "applied" }).eq("user_id", uid).select(),
      await anon.from("auto_apply_queue").insert({ user_id: uid, company_name: "X", job_title: "Y", apply_url: "https://x.test", dedupe_key: "x|y" }),
      await anon.from("auto_apply_events").insert({ user_id: uid, event: "approved" }),
    ];
    for (const attempt of attempts) {
      // Either an explicit RLS error, or zero rows changed.
      expect(attempt.error !== null || (Array.isArray(attempt.data) && attempt.data.length === 0)).toBe(true);
    }
    expect((await db().from("auto_apply_settings").select("daily_limit").eq("user_id", uid).single()).data?.daily_limit).toBe(5);
  });
});
