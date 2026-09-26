import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser } from "../support/test-user";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest, providersMocked } from "../support/cv-fixture";

// The Job Tracker, end to end against the REAL database (no mocked data layer). Only the outbound email provider is
// mocked (Resend), so the reminder dispatch route can run for real without sending anything.
//
// Start the server under test with the mocked providers and:
//   CRON_SECRET=e2e-cron-secret RESEND_API_KEY=e2e-resend-key RESEND_FROM_EMAIL=noreply@e2e.jobpilotai.test
// Serial: later steps build on earlier ones. Everything is owned by the one isolated test account (deleted after, which
// cascades to its applications, history, reminders and CV copies); the only rows outside that are one job and its match
// score, which are removed explicitly.

const test = makeCvTest({ name: "Tracker Tester", plan: "pro" });
const db = () => getAdminClient();
const CRON = { authorization: "Bearer e2e-cron-secret" };

test.skip(!providersMocked || process.env.CRON_SECRET !== "e2e-cron-secret", "needs the mocked-provider server with CRON_SECRET / RESEND_* set");
test.describe.configure({ mode: "serial" });

const BOARD = "/dashboard/applications";
const card = (page: Page, title: string) => page.getByTestId("application-card").filter({ hasText: title });
const column = (page: Page, status: string) => page.getByTestId(`column-${status}`);
const resultCount = (page: Page) => page.getByTestId("tracker-result-count");
const today = () => new Date().toISOString().slice(0, 10);

/** Navigates and clears the cookie banner, which is fixed to the bottom of the viewport and otherwise covers buttons at the foot of a page. */
async function go(page: Page, url: string) {
  await page.goto(url);
  await dismissCookieBanner(page);
}

async function pick(page: Page, label: string, option: string | RegExp) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option }).click();
}

async function seedApp(userId: string, fields: Record<string, unknown>) {
  const { data, error } = await db()
    .from("applications")
    .insert({ user_id: userId, company_name: "Seed Co", job_title: "Seed Role", status: "wishlist", ...fields })
    .select("id, status, applied_at, frozen_at")
    .single();
  if (error) throw new Error(`seedApp: ${error.message}`);
  return data!;
}

async function appByTitle(userId: string, title: string) {
  const { data } = await db().from("applications").select("*").eq("user_id", userId).eq("job_title", title).single();
  return data!;
}

async function clearApps(userId: string) {
  await db().from("applications").delete().eq("user_id", userId);
}

test.describe("tracker: create, edit, delete", () => {
  test("a new account sees an honest empty state, not sample data", async ({ open, account }) => {
    const { count } = await db().from("applications").select("id", { count: "exact", head: true }).eq("user_id", account.user.id);
    expect(count).toBe(0);
    const page = await open();
    await go(page, BOARD);
    await dismissCookieBanner(page);
    await expect(page.getByTestId("tracker-empty")).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse the job feed" })).toBeVisible();
    await expect(page.getByTestId("application-card")).toHaveCount(0);
  });

  test("create with every field, including a linked CV and cover letter, then see it on the board", async ({ open, account }) => {
    const cv = await seedCv(account.user.id, { title: "Tracker CV" });
    const { data: letter, error } = await db()
      .from("cover_letters")
      .insert({ user_id: account.user.id, company_name: "Full Fields Ltd", job_title: "Full Fields Role", job_description: "desc" })
      .select("id")
      .single();
    expect(error).toBeNull();
    await db().from("cover_letter_versions").insert({ cover_letter_id: letter!.id, user_id: account.user.id, cv_text_snapshot: "cv text", is_current: true });

    const page = await open();
    await go(page, `${BOARD}/new`);
    await dismissCookieBanner(page);
    await page.getByLabel("Company").fill("Full Fields Ltd");
    await page.getByLabel("Role").fill("Full Fields Role");
    await page.getByLabel("Location (optional)").fill("Leeds");
    await page.getByLabel("Salary (optional)").fill("£48,000–£55,000");
    await page.getByLabel("Job posting URL (optional)").fill("https://example.test/jobs/123");
    await page.getByLabel("Deadline (optional)").fill("2030-01-15");
    await page.getByLabel("Notes (optional)").fill("Referred by Sam. Ask about relocation.");
    await pick(page, "CV used (optional)", "Tracker CV");
    await pick(page, "Cover letter used (optional)", /Full Fields Ltd — Full Fields Role/);
    await page.getByRole("button", { name: "Add application" }).click();
    await page.waitForURL(/\/dashboard\/applications$/);

    const row = await appByTitle(account.user.id, "Full Fields Role");
    expect(row).toMatchObject({
      company_name: "Full Fields Ltd",
      location: "Leeds",
      salary: "£48,000–£55,000",
      url: "https://example.test/jobs/123",
      deadline: "2030-01-15",
      notes: "Referred by Sam. Ask about relocation.",
      status: "wishlist",
      cv_id: cv.cvId,
      cover_letter_id: letter!.id,
    });

    const boardCard = card(page, "Full Fields Role");
    await expect(column(page, "wishlist").getByText("Full Fields Role")).toBeVisible();
    await expect(boardCard).toContainText("Leeds");
    await expect(boardCard).toContainText("£48,000–£55,000");
    await expect(boardCard).toContainText("CV: Tracker CV");
    await expect(boardCard).toContainText("Letter: Full Fields Ltd");
    await expect(boardCard).toContainText("15 Jan");
  });

  test("an application needs no CV or cover letter, and rejects an invalid link", async ({ open, account }) => {
    const page = await open();
    await go(page, `${BOARD}/new`);
    await page.getByLabel("Company").fill("Plain Co");
    await page.getByLabel("Role").fill("Plain Role");
    await page.getByRole("button", { name: "Add application" }).click();
    await page.waitForURL(/\/dashboard\/applications$/);
    expect(await appByTitle(account.user.id, "Plain Role")).toMatchObject({ cv_id: null, cover_letter_id: null, status: "wishlist" });

    // A link that isn't http(s) is refused by the server (the browser's type=url check is bypassed here).
    await go(page, `${BOARD}/new`);
    await page.getByLabel("Company").fill("Bad Link Co");
    await page.getByLabel("Role").fill("Bad Link Role");
    await page.getByLabel("Job posting URL (optional)").evaluate((input: HTMLInputElement) => input.removeAttribute("type"));
    await page.getByLabel("Job posting URL (optional)").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Add application" }).click();
    await expect(page.locator("form p[role=alert]")).toContainText("valid URL");
    const { count } = await db().from("applications").select("id", { count: "exact", head: true }).eq("user_id", account.user.id).eq("job_title", "Bad Link Role");
    expect(count).toBe(0);
  });

  test("edit changes notes, salary, location and deadline, and the board reflects it", async ({ open, account }) => {
    const row = await appByTitle(account.user.id, "Plain Role");
    const page = await open();
    await go(page, `${BOARD}/${row.id}/edit`);
    await page.getByLabel("Location (optional)").fill("Manchester");
    await page.getByLabel("Salary (optional)").fill("£40k");
    await page.getByLabel("Deadline (optional)").fill("2030-02-01");
    await page.getByLabel("Notes (optional)").fill("Phone screen booked.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/dashboard\/applications$/);

    expect(await appByTitle(account.user.id, "Plain Role")).toMatchObject({ location: "Manchester", salary: "£40k", deadline: "2030-02-01", notes: "Phone screen booked." });
    await expect(card(page, "Plain Role")).toContainText("Manchester");
  });

  test("delete from the edit page and from the table, with a confirmation", async ({ open, account }) => {
    const first = await seedApp(account.user.id, { job_title: "Delete Me One", company_name: "Del Co" });
    await seedApp(account.user.id, { job_title: "Delete Me Two", company_name: "Del Co" });
    const page = await open();

    await go(page, `${BOARD}/${first.id}/edit`);
    page.once("dialog", (dialog) => void dialog.dismiss());
    await page.getByRole("button", { name: "Delete application" }).click();
    expect((await db().from("applications").select("id").eq("id", first.id)).data).toHaveLength(1); // cancelled: still there
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete application" }).click();
    await page.waitForURL(/\/dashboard\/applications$/);
    expect((await db().from("applications").select("id").eq("id", first.id)).data).toHaveLength(0);

    await page.getByRole("button", { name: "Table" }).click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete Delete Me Two at Del Co" }).click();
    await expect(page.getByRole("cell", { name: /Delete Me Two/ })).toHaveCount(0);
    expect((await db().from("applications").select("id").eq("user_id", account.user.id).eq("job_title", "Delete Me Two")).data).toHaveLength(0);
  });

  test("another person's application can't be opened or seen", async ({ open }) => {
    const stranger = await createIsolatedUser({ fullName: "Other Person" });
    try {
      const theirs = await seedApp(stranger.id, { job_title: "Not Yours", company_name: "Secret Co" });
      const page = await open();
      // Streamed pages answer 200 before notFound() renders, so assert on what the person sees, not the status code.
      await page.goto(`${BOARD}/${theirs.id}/edit`);
      await expect(page.getByText(/404|not found|could not be found/i).first()).toBeVisible();
      await expect(page.getByText("Secret Co")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Edit application" })).toHaveCount(0);
      await go(page, BOARD);
      await expect(page.getByText("Not Yours")).toHaveCount(0);
    } finally {
      await deleteIsolatedUser(stranger.id);
    }
  });
});

test.describe("kanban, table, drag and drop", () => {
  test("dragging a card to another column moves it, persists, and records history", async ({ open, account }) => {
    await clearApps(account.user.id);
    await seedApp(account.user.id, { job_title: "Drag Me", company_name: "Drag Co" });
    const page = await open();
    await go(page, BOARD);
    await dismissCookieBanner(page);

    await expect(column(page, "wishlist").getByText("Drag Me")).toBeVisible();
    await card(page, "Drag Me").dragTo(column(page, "interview"));
    await expect(column(page, "interview").getByText("Drag Me")).toBeVisible();
    await expect(column(page, "wishlist").getByText("Drag Me")).toHaveCount(0);

    await expect.poll(async () => (await appByTitle(account.user.id, "Drag Me")).status).toBe("interview");
    await page.reload();
    await expect(column(page, "interview").getByText("Drag Me")).toBeVisible();

    const { data: history } = await db().from("application_status_history").select("from_status, to_status").eq("user_id", account.user.id).order("changed_at");
    expect(history).toEqual([
      { from_status: null, to_status: "wishlist" },
      { from_status: "wishlist", to_status: "interview" },
    ]);
  });

  test("each card's status menu does the same move (touch and keyboard users), and every stage exists", async ({ open, account }) => {
    const page = await open();
    await go(page, BOARD);
    for (const stage of ["wishlist", "applied", "interview", "offer", "rejected", "withdrawn"]) await expect(column(page, stage)).toBeVisible();

    await pick(page, "Move Drag Me to a different status", "Offer");
    await expect(column(page, "offer").getByText("Drag Me")).toBeVisible();
    await pick(page, "Move Drag Me to a different status", "Withdrawn");
    await expect(column(page, "withdrawn").getByText("Drag Me")).toBeVisible();
    await expect.poll(async () => (await appByTitle(account.user.id, "Drag Me")).status).toBe("withdrawn");
  });

  test("the table shows the same applications and moves them too", async ({ open, account }) => {
    const page = await open();
    await go(page, BOARD);
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByTestId("application-row").filter({ hasText: "Drag Me" })).toHaveCount(1);
    await expect(page.getByRole("columnheader", { name: "Salary" })).toBeVisible();
    await pick(page, "Move Drag Me to a different status", "Rejected");
    await expect.poll(async () => (await appByTitle(account.user.id, "Drag Me")).status).toBe("rejected");
    await page.getByRole("button", { name: "Board" }).click();
    await expect(column(page, "rejected").getByText("Drag Me")).toBeVisible();
  });

  test("a failed move (deleted elsewhere) is not shown as done, and says why", async ({ open, account }) => {
    const ghost = await seedApp(account.user.id, { job_title: "Ghost Card", company_name: "Ghost Co" });
    const page = await open();
    await go(page, BOARD);
    await expect(card(page, "Ghost Card")).toBeVisible();
    await db().from("applications").delete().eq("id", ghost.id); // gone behind the page's back
    await pick(page, "Move Ghost Card to a different status", "Interview");
    await expect(page.getByRole("alert").filter({ hasText: "couldn't be found" })).toBeVisible();
    // Never left sitting in the column it was dragged to: it was reverted (and the refreshed board no longer has it at all).
    await expect(column(page, "interview").getByText("Ghost Card")).toHaveCount(0);
  });
});

test.describe("search, filter, sort", () => {
  test.beforeAll(async ({ account }) => {
    await clearApps(account.user.id);
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    await seedApp(account.user.id, { job_title: "Data Analyst", company_name: "Barclays", location: "London", salary: "£50,000", notes: "Referred by Sam", status: "applied", deadline: day(-3), sponsor_status: "confirmed_sponsor", match_score: 82 });
    await seedApp(account.user.id, { job_title: "Site Engineer", company_name: "Rolls-Royce", location: "Derby", status: "wishlist", deadline: day(3), match_score: 60 });
    await seedApp(account.user.id, { job_title: "Staff Nurse", company_name: "Acme Health", status: "rejected", deadline: day(-30), sponsor_status: "not_found" });
    await seedApp(account.user.id, { job_title: "Consultant", company_name: "Acme Consulting", status: "interview", deadline: day(60), match_score: 91 });
  });

  test("search covers company, role, location, salary and notes", async ({ open }) => {
    const page = await open();
    await go(page, BOARD);
    await dismissCookieBanner(page);
    await expect(resultCount(page)).toHaveText("4 matches");
    for (const [term, title] of [["barclays", "Data Analyst"], ["derby", "Site Engineer"], ["50,000", "Data Analyst"], ["referred", "Data Analyst"], ["nurse", "Staff Nurse"]] as const) {
      await page.getByLabel("Search").fill(term);
      await expect(resultCount(page)).toHaveText("1 match");
      await expect(card(page, title)).toBeVisible();
    }
    await page.getByLabel("Search").fill("acme");
    await expect(resultCount(page)).toHaveText("2 matches");
    await page.getByLabel("Search").fill("nothing like this");
    await expect(resultCount(page)).toHaveText("0 matches");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(resultCount(page)).toHaveText("4 matches");
  });

  test("status, sponsor state and deadline filters, on both views", async ({ open }) => {
    const page = await open();
    await go(page, BOARD);
    await pick(page, "Status", "Interview");
    await expect(resultCount(page)).toHaveText("1 match");
    await pick(page, "Status", "All statuses");

    await pick(page, "Sponsor state", "Licensed sponsor");
    await expect(resultCount(page)).toHaveText("1 match");
    await expect(card(page, "Data Analyst")).toBeVisible();
    await pick(page, "Sponsor state", "Not checked yet");
    await expect(resultCount(page)).toHaveText("2 matches");
    await pick(page, "Sponsor state", "All");

    await pick(page, "Deadline", "Overdue"); // the rejected one's past deadline isn't overdue: it's closed
    await expect(resultCount(page)).toHaveText("1 match");
    await expect(card(page, "Data Analyst")).toContainText("Overdue");
    await pick(page, "Deadline", "Due in the next 7 days");
    await expect(card(page, "Site Engineer")).toBeVisible();

    // The same filtered set in the table: switching view never changes it.
    await page.getByRole("button", { name: "Table" }).click();
    await expect(page.getByTestId("application-row")).toHaveCount(1);
    await expect(page.getByTestId("application-row").filter({ hasText: "Site Engineer" })).toHaveCount(1);
  });

  test("sorting: by company, by match score and by deadline", async ({ open }) => {
    const page = await open();
    await go(page, BOARD);
    await page.getByRole("button", { name: "Table" }).click();
    const titles = () => page.getByTestId("application-row").locator("td:first-child p.font-medium").allTextContents();

    await pick(page, "Sort by", "Company (A–Z)");
    expect(await titles()).toEqual(["Consultant", "Staff Nurse", "Data Analyst", "Site Engineer"]); // Acme Consulting, Acme Health, Barclays, Rolls-Royce
    await pick(page, "Sort by", "Match score (highest)");
    expect(await titles()).toEqual(["Consultant", "Data Analyst", "Site Engineer", "Staff Nurse"]);
    await pick(page, "Sort by", "Deadline (soonest)");
    expect(await titles()).toEqual(["Staff Nurse", "Data Analyst", "Site Engineer", "Consultant"]);
  });
});

test.describe("sponsor, match score, and the first-Applied freeze", () => {
  test("first Applied freezes the sponsor state, match score and a permanent copy of the CV", async ({ open, account }) => {
    await clearApps(account.user.id);
    const cv = await seedCv(account.user.id, { title: "Freeze CV", fullName: "Freeze Person" });
    const { data: source } = await db().from("job_sources").select("id").eq("slug", "manual").single();
    const { data: job } = await db()
      .from("jobs")
      .insert({ source_id: source!.id, title: "E2E Tracker Job", title_normalized: "e2e tracker job", company_name: "Rolls-Royce plc", company_name_normalized: "rolls-royce plc", description: "e2e", url: "https://example.test/job" })
      .select("id")
      .single();
    try {
      await db().from("job_matches").insert({
        user_id: account.user.id, job_id: job!.id, cv_version_id: cv.versionId, match_score: 77, verdict: "worth_applying", reasons: ["r"], gaps: [], prompt_version: "e2e",
        core_skills_score: 70, core_skills_summary: "s", tech_functional_skills_score: 70, tech_functional_skills_summary: "s", domain_fit_score: 70, domain_fit_summary: "s", seniority_score: 70, seniority_summary: "s",
      });
      const app = await seedApp(account.user.id, { job_title: "Freeze Role", company_name: "Rolls-Royce plc", job_id: job!.id, cv_id: cv.cvId });

      // Before Applied nothing is frozen; the live values already show.
      const before = await appByTitle(account.user.id, "Freeze Role");
      expect(before).toMatchObject({ frozen_at: null, submitted_cv_version_id: null, applied_at: null });

      const page = await open();
      await go(page, BOARD);
      await dismissCookieBanner(page);
      await card(page, "Freeze Role").dragTo(column(page, "applied"));
      await expect(page.getByRole("img", { name: "Frozen since first moved to Applied" })).toBeVisible();

      const frozen = await appByTitle(account.user.id, "Freeze Role");
      expect(frozen.sponsor_status).toBe("confirmed_sponsor");
      expect(frozen.match_score).toBe(77);
      expect(frozen.frozen_at).not.toBeNull();
      expect(frozen.applied_at).toBe(today());
      expect(frozen.submitted_cv_version_id).not.toBeNull();
      expect(frozen.submitted_cv_version_id).not.toBe(cv.versionId); // a COPY, not the live version

      const { data: copy } = await db().from("cv_versions").select("id, is_current, label").eq("id", frozen.submitted_cv_version_id).single();
      expect(copy).toMatchObject({ is_current: false, label: "Submitted: Freeze Role at Rolls-Royce plc" });
      const { data: copiedPersonal } = await db().from("cv_personal").select("headline").eq("cv_version_id", copy!.id).single();
      expect(copiedPersonal?.headline).toBe("Senior Platform Engineer");

      // The CV is edited afterwards: the live version changes, the submitted copy does not.
      await db().from("cv_personal").update({ headline: "Chief Bread Officer" }).eq("cv_version_id", cv.versionId);
      const { data: liveNow } = await db().from("cv_personal").select("headline").eq("cv_version_id", cv.versionId).single();
      const { data: copyNow } = await db().from("cv_personal").select("headline").eq("cv_version_id", copy!.id).single();
      expect(liveNow?.headline).toBe("Chief Bread Officer");
      expect(copyNow?.headline).toBe("Senior Platform Engineer");

      // Editing the application afterwards (new company, no CV, later status) can't change the frozen snapshot.
      await go(page, `${BOARD}/${app.id}/edit`);
      await expect(page.getByTestId("snapshot-panel")).toContainText("Frozen when first moved to Applied");
      await expect(page.getByTestId("snapshot-panel")).toContainText("Submitted: Freeze Role at Rolls-Royce plc");
      await page.getByLabel("Company").fill("Some Unlisted Startup");
      await pick(page, "CV used (optional)", "None");
      await pick(page, "Status", "Interview");
      await page.getByRole("button", { name: "Save changes" }).click();
      await page.waitForURL(/\/dashboard\/applications$/);

      const afterEdit = await appByTitle(account.user.id, "Freeze Role");
      expect(afterEdit).toMatchObject({
        company_name: "Some Unlisted Startup",
        cv_id: null,
        status: "interview",
        sponsor_status: "confirmed_sponsor",
        match_score: 77,
        submitted_cv_version_id: frozen.submitted_cv_version_id,
        frozen_at: frozen.frozen_at,
        applied_at: frozen.applied_at,
      });

      // Moving it back out of Applied doesn't unfreeze it.
      await pick(page, "Move Freeze Role to a different status", "Wishlist");
      await expect(page.getByRole("img", { name: "Frozen since first moved to Applied" })).toBeVisible();
      await expect.poll(async () => (await appByTitle(account.user.id, "Freeze Role")).status).toBe("wishlist");

      // Even a direct database write can't overwrite it (migration 0065 trigger).
      await db().from("applications").update({ sponsor_status: "not_found", match_score: 1, submitted_cv_version_id: null, frozen_at: null }).eq("id", app.id);
      expect(await appByTitle(account.user.id, "Freeze Role")).toMatchObject({ sponsor_status: "confirmed_sponsor", match_score: 77, submitted_cv_version_id: frozen.submitted_cv_version_id, frozen_at: frozen.frozen_at });

      // Re-entering Applied later doesn't make a second copy or re-freeze.
      await pick(page, "Move Freeze Role to a different status", "Applied");
      await expect.poll(async () => (await appByTitle(account.user.id, "Freeze Role")).status).toBe("applied");
      expect((await appByTitle(account.user.id, "Freeze Role")).submitted_cv_version_id).toBe(frozen.submitted_cv_version_id);
      const { count: copies } = await db().from("cv_versions").select("id", { count: "exact", head: true }).eq("cv_id", cv.cvId).like("label", "Submitted:%");
      expect(copies).toBe(1);
    } finally {
      await db().from("job_matches").delete().eq("job_id", job!.id);
      await db().from("applications").delete().eq("job_id", job!.id);
      await db().from("jobs").delete().eq("id", job!.id);
    }
  });

  test("with no CV linked it still freezes the sponsor state; with no job the score stays empty", async ({ open, account }) => {
    await clearApps(account.user.id);
    const app = await seedApp(account.user.id, { job_title: "No CV Role", company_name: "Barclays Bank PLC" });
    const page = await open();
    await go(page, BOARD);
    await pick(page, "Move No CV Role to a different status", "Applied");
    await expect.poll(async () => (await appByTitle(account.user.id, "No CV Role")).frozen_at).not.toBeNull();
    expect(await appByTitle(account.user.id, "No CV Role")).toMatchObject({ sponsor_status: "confirmed_sponsor", match_score: null, submitted_cv_version_id: null, id: app.id });
    await go(page, `${BOARD}/${app.id}/edit`);
    await expect(page.getByTestId("snapshot-panel")).toContainText("no CV was linked");
  });

  test("the database freezes an application that reaches Applied by any route (backstop)", async ({ account }) => {
    const direct = await seedApp(account.user.id, { job_title: "Direct Applied", company_name: "Direct Co", status: "applied" });
    expect(direct.frozen_at).not.toBeNull();
    expect(direct.applied_at).toBe(today());
  });
});

test.describe("history", () => {
  test("the edit page lists every move in order, from creation", async ({ open, account }) => {
    await clearApps(account.user.id);
    const app = await seedApp(account.user.id, { job_title: "History Role", company_name: "History Co" });
    const page = await open();
    await go(page, BOARD);
    await pick(page, "Move History Role to a different status", "Applied");
    await expect.poll(async () => (await appByTitle(account.user.id, "History Role")).status).toBe("applied");
    await pick(page, "Move History Role to a different status", "Interview");
    await expect.poll(async () => (await appByTitle(account.user.id, "History Role")).status).toBe("interview");
    await pick(page, "Move History Role to a different status", "Offer");
    await expect.poll(async () => (await appByTitle(account.user.id, "History Role")).status).toBe("offer");

    await go(page, `${BOARD}/${app.id}/edit`);
    const entries = page.getByTestId("application-history").locator("li");
    await expect(entries).toHaveCount(4);
    await expect(entries.nth(0)).toContainText("Added as Wishlist");
    await expect(entries.nth(1)).toContainText("Moved from Wishlist to Applied");
    await expect(entries.nth(2)).toContainText("Moved from Applied to Interview");
    await expect(entries.nth(3)).toContainText("Moved from Interview to Offer");
  });
});

test.describe("reminders", () => {
  test("a reminder set in the person's own time zone fires at the right instant, and shows in-app when due", async ({ browser, account }) => {
    await clearApps(account.user.id);
    const app = await seedApp(account.user.id, { job_title: "Reminder Role", company_name: "Remind Co" });
    // A zone far from UTC: if the server read the typed time as UTC the stored instant would be ~12-13 hours off.
    const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", storageState: account.state, timezoneId: "Pacific/Auckland" });
    const page = await context.newPage();
    try {
      await go(page, `${BOARD}/${app.id}/edit`);
      await dismissCookieBanner(page);
      const localNow = await page.evaluate(() => {
        const d = new Date();
        const p = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      });
      await page.getByLabel("Date & time").fill(localNow);
      await page.getByLabel("Message").fill("Chase the recruiter");
      await page.getByRole("checkbox", { name: "Email me" }).check();
      await page.getByRole("button", { name: "Add reminder" }).click();
      await expect(page.getByTestId("reminder-row")).toContainText("Chase the recruiter");

      const { data: reminder } = await db().from("application_reminders").select("*").eq("application_id", app.id).single();
      expect(Math.abs(new Date(reminder!.remind_at).getTime() - Date.now())).toBeLessThan(3 * 60_000); // right instant, not 12h off
      expect(reminder).toMatchObject({ send_email: true, send_in_app: true, email_status: "pending", in_app_status: "pending" });

      // Due now: the tracker shows it in-app at once, and the card carries the count.
      await go(page, BOARD);
      const due = page.getByTestId("due-reminders");
      await expect(due).toContainText("1 reminder due");
      await expect(due).toContainText("Chase the recruiter");
      await expect(card(page, "Reminder Role")).toContainText("1 due");
    } finally {
      await context.close();
    }
  });

  test("the delivery job sends the email once and records both channels", async ({ request, account }) => {
    const first = await request.get("/api/cron/dispatch-reminders", { headers: CRON });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ emailsSent: 1, emailsFailed: 0 });

    const { data: reminder } = await db().from("application_reminders").select("email_status, email_sent_at, in_app_status, in_app_sent_at, email_error").eq("user_id", account.user.id).single();
    expect(reminder).toMatchObject({ email_status: "sent", in_app_status: "sent", email_error: null });
    expect(reminder?.email_sent_at).not.toBeNull();

    const again = await request.get("/api/cron/dispatch-reminders", { headers: CRON });
    expect(await again.json()).toMatchObject({ emailsSent: 0 }); // idempotent: never sent twice

    expect((await request.get("/api/cron/dispatch-reminders")).status()).toBe(401); // closed without the secret
  });

  test("marking it done clears it from the tracker; a past time is refused; future ones show as scheduled", async ({ open, account }) => {
    const app = (await db().from("applications").select("id").eq("user_id", account.user.id).eq("job_title", "Reminder Role").single()).data!;
    const page = await open();
    await go(page, BOARD);
    await page.getByTestId("due-reminders").getByRole("button", { name: "Mark done" }).click();
    await expect(page.getByTestId("due-reminders")).toHaveCount(0);
    const { data: done } = await db().from("application_reminders").select("completed_at").eq("application_id", app.id).single();
    expect(done?.completed_at).not.toBeNull();

    await go(page, `${BOARD}/${app.id}/edit`);
    await page.getByLabel("Date & time").fill("2020-01-01T09:00");
    await page.getByLabel("Message").fill("In the past");
    await page.getByRole("button", { name: "Add reminder" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "future" })).toBeVisible();

    await page.getByLabel("Date & time").fill("2031-03-05T09:30");
    await page.getByLabel("Message").fill("Follow up next month");
    await page.getByRole("checkbox", { name: "Show in-app" }).check();
    await page.getByRole("button", { name: "Add reminder" }).click();
    await expect(page.getByTestId("reminder-row").filter({ hasText: "Follow up next month" })).toContainText("In-app: Scheduled");
    await go(page, BOARD);
    await expect(card(page, "Reminder Role")).toContainText("1 reminder");
    await expect(page.getByTestId("due-reminders")).toHaveCount(0); // not due yet

    // Deleting a reminder removes it.
    await go(page, `${BOARD}/${app.id}/edit`);
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByTestId("reminder-row").filter({ hasText: "Follow up next month" }).getByRole("button", { name: "Delete reminder" }).click();
    await expect(page.getByTestId("reminder-row").filter({ hasText: "Follow up next month" })).toHaveCount(0);
  });
});

test.describe("analytics", () => {
  test("shows an honest empty state, then real numbers computed from the history", async ({ open, account }) => {
    await clearApps(account.user.id);
    const page = await open();
    await go(page, `${BOARD}/analytics`);
    await expect(page.getByText("No applications tracked yet")).toBeVisible();

    // A: Wishlist -> Applied -> Interview -> Offer. B: straight to Applied, then Rejected. C: still Wishlist.
    const a = await seedApp(account.user.id, { job_title: "Stats A", company_name: "Stats Co" });
    for (const status of ["applied", "interview", "offer"]) await db().from("applications").update({ status }).eq("id", a.id);
    const b = await seedApp(account.user.id, { job_title: "Stats B", company_name: "Stats Co", status: "applied", sponsor_status: "confirmed_sponsor", match_score: 80 });
    await db().from("applications").update({ status: "rejected" }).eq("id", b.id);
    await seedApp(account.user.id, { job_title: "Stats C", company_name: "Stats Co", sponsor_status: "not_found", match_score: 60 });

    // Give the history real spacing: A applied 10 days ago, interview 6 days ago, offer 3 days ago.
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    for (const [status, days] of [["applied", 10], ["interview", 6], ["offer", 3]] as const) {
      await db().from("application_status_history").update({ changed_at: at(days) }).eq("application_id", a.id).eq("to_status", status);
    }
    await db().from("application_status_history").update({ changed_at: at(40) }).eq("application_id", b.id).eq("to_status", "applied"); // outside 30 days

    await go(page, `${BOARD}/analytics`);
    const tile = (label: string) => page.locator("div").filter({ has: page.getByText(label, { exact: true }) }).last();
    await expect(tile("Total applications")).toContainText("3");
    await expect(tile("Total applications")).toContainText("1 in flight"); // A is at Offer; B rejected; C wishlist
    await expect(tile("Applied in the last 30 days")).toContainText("1");
    await expect(tile("Interview rate")).toContainText("50%"); // of the 2 that were applied, 1 reached interview
    await expect(tile("Offer rate")).toContainText("50%");
    await expect(tile("Average match score")).toContainText("70/100"); // (80 + 60) / 2, the one with none is left out
    await expect(tile("Average match score")).toContainText("across 2 scored");
    await expect(tile("Median days from Applied to first Interview")).toContainText("4");
    await expect(tile("Median days from Applied to first Offer")).toContainText("7");
    await expect(page.getByText("Licensed sponsor").first()).toBeVisible();
    await expect(page.getByText("Conversion funnel")).toBeVisible();
  });
});
