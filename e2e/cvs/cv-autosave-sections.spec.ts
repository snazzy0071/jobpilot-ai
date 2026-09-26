import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { markOnboarded, setPlan } from "../support/roles";
import { seedCv } from "../support/cv";

// Autosave for every part of the CV editor, through the real UI and the real database: each edit is written to
// its own table, the header reports Saving → Saved, and the value is still there after a reload.
// (Templates, PDF and ATS are covered elsewhere; this file is only about edits being saved.)

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DESKTOP = { width: 1360, height: 900 };

type Account = { user: IsolatedUser; state: string };

const test = base.extend<{ open: () => Promise<Page> }, { account: Account }>({
  // One account for the file, signed in once (the login endpoint is rate limited per IP).
  account: [
    async ({ browser }, use) => {
      const user = await createIsolatedUser({ fullName: "CV Autosave Tester" });
      await markOnboarded(user.id);
      await setPlan(user.id, "pro"); // template choice is limited on Free (cv_template_count), and these specs switch templates
      const state = `test-results/.cv-autosave-${user.id}.json`;
      try {
        const context = await browser.newContext({ baseURL: BASE_URL });
        const page = await context.newPage();
        await page.goto("/login");
        await page.getByLabel("Email").fill(user.email);
        await page.getByLabel("Password", { exact: true }).fill(user.password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/dashboard$/);
        await context.storageState({ path: state });
        await context.close();
        await use({ user, state });
      } finally {
        await deleteIsolatedUser(user.id);
      }
    },
    { scope: "worker", timeout: 120_000 },
  ],
  open: async ({ browser, account }, use) => {
    const contexts: { close: () => Promise<void> }[] = [];
    await use(async () => {
      const context = await (browser as Browser).newContext({ baseURL: BASE_URL, storageState: account.state, viewport: DESKTOP });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

const db = () => getAdminClient();
const saveState = (page: Page) => page.locator("[data-save-state]");
const rowForm = (page: Page, label: string) => page.locator("form").filter({ has: page.getByLabel(label, { exact: true }) });

async function editorFor(open: () => Promise<Page>, userId: string) {
  const { cvId, versionId } = await seedCv(userId);
  const page = await open();
  await page.goto(`/dashboard/cvs/${cvId}`);
  await expect(page.getByLabel("Full name")).toBeVisible();
  // The cookie banner is fixed to the bottom of the viewport and would sit over the "Add …" buttons.
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
  return { page, cvId, versionId };
}

async function expectSaved(page: Page) {
  await expect(saveState(page)).toHaveAttribute("data-save-state", "saved", { timeout: 15_000 });
}

test.describe("every section autosaves and survives a reload", () => {
  test("personal details (all eight fields)", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    const values = {
      "Full name": "Grace Autosave",
      Headline: "Staff Engineer",
      Email: "grace@example.com",
      Phone: "07700 900111",
      Location: "Bristol, UK",
      Website: "https://grace.example.com",
      LinkedIn: "https://www.linkedin.com/in/grace",
      Portfolio: "https://portfolio.example.com",
    };
    for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(value);

    await expect
      .poll(async () => (await db().from("cv_personal").select("*").eq("cv_version_id", versionId).single()).data, { timeout: 15_000 })
      .toMatchObject({
        full_name: "Grace Autosave",
        headline: "Staff Engineer",
        email: "grace@example.com",
        phone: "07700 900111",
        location: "Bristol, UK",
        website_url: "https://grace.example.com",
        linkedin_url: "https://www.linkedin.com/in/grace",
        portfolio_url: "https://portfolio.example.com",
      });
    await expectSaved(page);
    await page.reload();
    for (const [label, value] of Object.entries(values)) await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  });

  test("clearing an optional field saves the clearing, not the old value", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByLabel("Phone", { exact: true }).fill("");
    await expect
      .poll(async () => (await db().from("cv_personal").select("phone").eq("cv_version_id", versionId).single()).data?.phone ?? null, { timeout: 15_000 })
      .toBeNull();
    await expectSaved(page);
    await page.reload();
    await expect(page.getByLabel("Phone", { exact: true })).toHaveValue("");
  });

  test("summary", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.locator("textarea[name='content']").first().fill("A rewritten summary that must survive a reload.");
    await expect
      .poll(async () => (await db().from("cv_summary").select("content").eq("cv_version_id", versionId).single()).data?.content, { timeout: 15_000 })
      .toBe("A rewritten summary that must survive a reload.");
    await expectSaved(page);
    await page.reload();
    await expect(page.locator("textarea[name='content']").first()).toHaveValue("A rewritten summary that must survive a reload.");
  });

  test("experience: a new role, then flipping it to current", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add role" }).click();
    const form = rowForm(page, "Job title");
    await form.getByLabel("Job title").fill("Autosave Lead");
    await form.getByLabel("Employer").fill("Persist Ltd");
    await form.getByLabel("Start date").fill("2019-05-01");
    await form.getByLabel("End date").fill("2021-02-01");
    await form.locator("textarea[name='description']").fill("- Shipped the thing");

    const rows = async () => (await db().from("cv_experience").select("job_title, employer, start_date, end_date, is_current, description").eq("cv_version_id", versionId).eq("job_title", "Autosave Lead")).data;
    await expect.poll(rows, { timeout: 15_000 }).toEqual([
      { job_title: "Autosave Lead", employer: "Persist Ltd", start_date: "2019-05-01", end_date: "2021-02-01", is_current: false, description: "- Shipped the thing" },
    ]);
    await expectSaved(page);

    await form.getByRole("checkbox").check();
    await expect.poll(async () => (await rows())?.[0]?.is_current, { timeout: 15_000 }).toBe(true);
    expect((await rows())?.[0]?.end_date ?? null).toBeNull(); // "current" clears the end date
    expect(await rows()).toHaveLength(1);
    await expectSaved(page);

    await page.reload();
    await expect(page.getByText("Autosave Lead").first()).toBeVisible();
  });

  test("education", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add qualification" }).click();
    const form = rowForm(page, "Institution");
    await form.getByLabel("Institution").fill("University of Autosave");
    await form.getByLabel("Qualification").fill("BSc Computer Science");
    await form.getByLabel("Field of study").fill("Computing");
    await form.getByLabel("Start date").fill("2015-09-01");
    await form.getByLabel("End date").fill("2018-06-01");
    await form.getByLabel("Grade").fill("First");
    await form.locator("textarea[name='description']").fill("Dissertation on saving things.");

    await expect
      .poll(async () => (await db().from("cv_education").select("institution, qualification, field_of_study, start_date, end_date, grade, description").eq("cv_version_id", versionId).eq("institution", "University of Autosave")).data, { timeout: 15_000 })
      .toEqual([
        { institution: "University of Autosave", qualification: "BSc Computer Science", field_of_study: "Computing", start_date: "2015-09-01", end_date: "2018-06-01", grade: "First", description: "Dissertation on saving things." },
      ]);
    await expectSaved(page);
    await page.reload();
    await expect(page.getByText("University of Autosave").first()).toBeVisible();
  });

  test("skills", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add skill" }).click();
    const form = rowForm(page, "Skill");
    await form.getByLabel("Skill", { exact: true }).fill("Autosaving");
    await expect
      .poll(async () => (await db().from("cv_skills").select("name").eq("cv_version_id", versionId).eq("name", "Autosaving")).data, { timeout: 15_000 })
      .toEqual([{ name: "Autosaving" }]);
    await expectSaved(page);
    await page.reload();
    await expect(page.getByText("Autosaving").first()).toBeVisible();
  });

  test("projects", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add project" }).click();
    const form = rowForm(page, "Project name");
    await form.getByLabel("Project name").fill("Autosave Engine");
    await form.getByLabel("Link").fill("https://example.com/autosave");
    await form.getByLabel("Start date").fill("2023-01-01");
    await form.getByLabel("Technologies").fill("TypeScript, Postgres");
    await form.locator("textarea[name='description']").fill("Keeps edits safe.");
    await expect
      .poll(async () => (await db().from("cv_projects").select("name, url, start_date, description").eq("cv_version_id", versionId).eq("name", "Autosave Engine")).data, { timeout: 15_000 })
      .toEqual([{ name: "Autosave Engine", url: "https://example.com/autosave", start_date: "2023-01-01", description: "Keeps edits safe." }]);
    await expectSaved(page);

    await form.getByRole("checkbox").check(); // ongoing
    await expect
      .poll(async () => (await db().from("cv_projects").select("is_ongoing").eq("cv_version_id", versionId).eq("name", "Autosave Engine")).data?.[0]?.is_ongoing, { timeout: 15_000 })
      .toBe(true);
    await expectSaved(page);
    await page.reload();
    await expect(page.getByText("Autosave Engine").first()).toBeVisible();
  });

  test("certifications", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add certification" }).click();
    const form = rowForm(page, "Certification");
    await form.getByLabel("Certification", { exact: true }).fill("Certified Autosaver");
    await form.getByLabel("Issuing organization").fill("Persistence Board");
    await form.getByLabel("Issue date").fill("2022-04-01");
    await form.getByLabel("Credential ID").fill("CA-123");
    await expect
      .poll(async () => (await db().from("cv_certifications").select("name, issuing_organization, issue_date, credential_id").eq("cv_version_id", versionId).eq("name", "Certified Autosaver")).data, { timeout: 15_000 })
      .toEqual([{ name: "Certified Autosaver", issuing_organization: "Persistence Board", issue_date: "2022-04-01", credential_id: "CA-123" }]);
    await expectSaved(page);
    await page.reload();
    await expect(page.getByText("Certified Autosaver").first()).toBeVisible();
  });

  test("languages, including changing the proficiency select", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add language" }).click();
    const form = rowForm(page, "Language");
    await form.getByLabel("Language", { exact: true }).fill("Welsh");
    await form.getByLabel("Proficiency", { exact: true }).click();
    await page.getByRole("option", { name: "Fluent", exact: true }).click();
    await expect
      .poll(async () => (await db().from("cv_languages").select("name, proficiency").eq("cv_version_id", versionId).eq("name", "Welsh")).data, { timeout: 15_000 })
      .toEqual([{ name: "Welsh", proficiency: "fluent" }]);
    await expectSaved(page);
    await page.reload();
    await expect(page.getByText("Welsh").first()).toBeVisible();
  });

  test("custom sections (their labels point at their own fields, not the CV title or summary)", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add section" }).click();
    const form = rowForm(page, "Section title");
    await form.getByLabel("Section title").fill("Volunteering");
    await form.getByLabel("Content").fill("Mentors graduates every month.");
    await expect
      .poll(async () => (await db().from("cv_custom_sections").select("title, content").eq("cv_version_id", versionId).eq("title", "Volunteering")).data, { timeout: 15_000 })
      .toEqual([{ title: "Volunteering", content: "Mentors graduates every month." }]);
    await expectSaved(page);
    await page.reload();
    await expect(page.getByText("Volunteering").first()).toBeVisible();
  });
});

test.describe("the other ways an edit reaches the database", () => {
  test("renaming the CV saves on Enter and on blur", async ({ open, account }) => {
    const { page, cvId } = await editorFor(open, account.user.id);
    const title = page.getByLabel("CV title");
    await title.fill("Renamed With Enter");
    await title.press("Enter");
    await expect.poll(async () => (await db().from("cvs").select("title").eq("id", cvId).single()).data?.title, { timeout: 15_000 }).toBe("Renamed With Enter");

    await title.fill("Renamed With Blur");
    await page.getByLabel("Headline").focus(); // leaves the title field
    await expect.poll(async () => (await db().from("cvs").select("title").eq("id", cvId).single()).data?.title, { timeout: 15_000 }).toBe("Renamed With Blur");
    await page.reload();
    await expect(page.getByLabel("CV title")).toHaveValue("Renamed With Blur");
  });

  test("leaving the page right after typing a title still saves it", async ({ open, account }) => {
    const { page, cvId } = await editorFor(open, account.user.id);
    await page.getByLabel("CV title").fill("Saved On The Way Out");
    await page.getByRole("link", { name: "All CVs" }).click(); // inside the pause, no blur-to-save first
    await page.waitForURL(/\/dashboard\/cvs$/);
    await expect.poll(async () => (await db().from("cvs").select("title").eq("id", cvId).single()).data?.title, { timeout: 15_000 }).toBe("Saved On The Way Out");
  });

  test("a rename typed and then left alone is saved by itself (no Enter, no blur needed)", async ({ open, account }) => {
    const { page, cvId } = await editorFor(open, account.user.id);
    await page.getByLabel("CV title").fill("Typed Then Reloaded");
    await expect(saveState(page)).toHaveAttribute("data-save-state", "saving"); // shows immediately
    await expectSaved(page);
    await page.reload();
    await expect(page.getByLabel("CV title")).toHaveValue("Typed Then Reloaded");
    await expect.poll(async () => (await db().from("cvs").select("title").eq("id", cvId).single()).data?.title, { timeout: 15_000 }).toBe("Typed Then Reloaded");
  });

  test("hiding a skill persists, and deleting a row removes it for good", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add skill" }).click();
    const form = rowForm(page, "Skill");
    await form.getByLabel("Skill", { exact: true }).fill("Hide Me");
    await expect.poll(async () => (await db().from("cv_skills").select("id").eq("cv_version_id", versionId).eq("name", "Hide Me")).data?.length, { timeout: 15_000 }).toBe(1);
    await expectSaved(page);
    await form.getByRole("button", { name: /done/i }).click();

    // The row's own controls (the seeded CV has other skills with the same buttons).
    const row = page.getByText("Hide Me").first().locator("xpath=ancestor::*[.//button[@aria-label='Hide from CV']][1]");
    await row.getByRole("button", { name: "Hide from CV" }).click();
    await expect
      .poll(async () => (await db().from("cv_skills").select("is_visible").eq("cv_version_id", versionId).eq("name", "Hide Me")).data?.[0]?.is_visible, { timeout: 15_000 })
      .toBe(false);
    await page.reload();
    await expect(page.getByText("Hide Me").first().locator("xpath=ancestor::*[.//button[@aria-label='Show on CV']][1]").getByRole("button", { name: "Show on CV" })).toBeVisible();

    await page.getByText("Hide Me").first().locator("xpath=ancestor::*[.//button[@aria-label='Delete skill']][1]").getByRole("button", { name: "Delete skill" }).click();
    await expect.poll(async () => (await db().from("cv_skills").select("id").eq("cv_version_id", versionId).eq("name", "Hide Me")).data?.length, { timeout: 15_000 }).toBe(0);
    await page.reload();
    await expect(page.getByText("Hide Me")).toHaveCount(0);
  });

  test("typing continuously ends with the last text saved, exactly once per row", async ({ open, account }) => {
    const { page, versionId } = await editorFor(open, account.user.id);
    await page.getByRole("button", { name: "Add skill" }).click();
    const input = rowForm(page, "Skill").getByLabel("Skill", { exact: true });
    await input.pressSequentially("Continuous typing test", { delay: 120 });
    await expect
      .poll(async () => (await db().from("cv_skills").select("name").eq("cv_version_id", versionId).like("name", "Continuous%")).data, { timeout: 15_000 })
      .toEqual([{ name: "Continuous typing test" }]);
    await expectSaved(page);
  });
});
