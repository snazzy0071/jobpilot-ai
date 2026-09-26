import { test as base, expect, type Browser, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";

// The editor's preview must always show the CV as it currently is — the saved data with whatever is being typed on
// top, in the selected template — and never a stale copy: not after a save and refresh, a delete, a hide, a version
// restore, a template change, or on the mobile sheet. Rendering only: save logic and PDF export are covered elsewhere.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DESKTOP = { width: 1360, height: 900 };
const PHONE = { width: 375, height: 760 };

type Account = { user: IsolatedUser; state: string };

const test = base.extend<{ open: (viewport?: { width: number; height: number }) => Promise<Page> }, { account: Account }>({
  account: [
    async ({ browser }, use) => {
      const user = await createIsolatedUser({ fullName: "CV Preview Tester" });
      await markOnboarded(user.id);
      const state = `test-results/.cv-preview-${user.id}.json`;
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
    await use(async (viewport = DESKTOP) => {
      const context = await (browser as Browser).newContext({ baseURL: BASE_URL, storageState: account.state, viewport });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

const db = () => getAdminClient();
const saveState = (page: Page) => page.locator("[data-save-state]");
const rowForm = (page: Page, label: string) => page.locator("form").filter({ has: page.getByLabel(label, { exact: true }) });
const preview = (page: Page) => page.locator(".cv-document").first();
const previewTemplate = (page: Page) => page.locator("[data-cv-template]").first();
const norm = (text: string) => text.replace(/\s+/g, " ").trim();
// Visible first: the editor streams in behind its loading screen, and until it is swapped in the preview exists only
// in a hidden container, whose innerText has no line breaks between blocks.
const previewText = async (page: Page) => {
  await expect(preview(page)).toBeVisible();
  return norm(await preview(page).innerText());
};

async function openEditor(open: (viewport?: { width: number; height: number }) => Promise<Page>, userId: string, options: Parameters<typeof seedCv>[1] = {}, viewport = DESKTOP) {
  const { cvId, versionId } = await seedCv(userId, options);
  const page = await open(viewport);
  await page.goto(`/dashboard/cvs/${cvId}`);
  await expect(page.getByLabel("Full name")).toBeVisible();
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
  return { page, cvId, versionId };
}

/** The preview shows only the first two pages by default; reveal the rest so content that lands on a later page can be asserted on. */
async function showAllPages(page: Page) {
  const more = page.getByRole("button", { name: /^Show all \d+/ });
  if (await more.isVisible().catch(() => false)) await more.click();
}

/** Waits for text to appear in the preview, revealing later pages as the page count grows. */
const expectInPreview = (page: Page, text: string) =>
  expect
    .poll(
      async () => {
        await showAllPages(page);
        return previewText(page);
      },
      { message: `preview should contain "${text}"`, timeout: 15_000 },
    )
    .toContain(text);

const expectSaved = (page: Page) => expect(saveState(page)).toHaveAttribute("data-save-state", "saved", { timeout: 15_000 });

test.describe("the preview shows the current CV", () => {
  test("typing shows in the preview at once, and the preview is identical after a save and after a reload", async ({ open, account }) => {
    const { page } = await openEditor(open, account.user.id);
    await page.getByLabel("Full name").fill("Preview Parity Person");
    await page.getByLabel("Headline").fill("Head of Rendering");
    await page.locator("textarea[name='content']").first().fill("A summary written for the preview parity check.");
    await expect(preview(page)).toContainText("Preview Parity Person"); // before any save has had time to finish
    await expect(preview(page)).toContainText("Head of Rendering");
    await expect(preview(page)).toContainText("A summary written for the preview parity check.");

    await expectSaved(page);
    const afterSave = await previewText(page);
    await page.reload();
    await expect(preview(page)).toContainText("Preview Parity Person");
    expect(await previewText(page)).toBe(afterSave); // what was shown while typing is what is really saved
  });

  test("every other section reaches the preview once saved, and the preview matches a reload", async ({ open, account }) => {
    const { page } = await openEditor(open, account.user.id);

    await page.getByRole("button", { name: "Add role" }).click();
    const role = rowForm(page, "Job title");
    await role.getByLabel("Job title").fill("Preview Role Lead");
    await role.getByLabel("Employer").fill("Renderco");
    await role.getByLabel("Start date").fill("2020-01-01");
    await expect(preview(page)).toContainText("Preview Role Lead");
    await expectSaved(page);
    // The row's form is still open: the saved role and the live edit of it must be one entry, not two.
    await expect.poll(async () => ((await previewText(page)).match(/Preview Role Lead/g) ?? []).length).toBe(1);
    await role.getByLabel("Employer").fill("Renderco Ltd"); // keeps following the same row after its first save
    await expect(preview(page)).toContainText("Renderco Ltd");
    await expectSaved(page);
    expect(((await previewText(page)).match(/Preview Role Lead/g) ?? []).length).toBe(1);

    await page.getByRole("button", { name: "Add qualification" }).click();
    const education = rowForm(page, "Institution");
    await education.getByLabel("Institution").fill("Preview University");
    await education.getByLabel("Qualification").fill("MSc Rendering");
    await expect(preview(page)).toContainText("Preview University");
    await expectSaved(page);
    await expect.poll(async () => ((await previewText(page)).match(/Preview University/g) ?? []).length).toBe(1);

    await page.getByRole("button", { name: "Add skill" }).click();
    await rowForm(page, "Skill").getByLabel("Skill", { exact: true }).fill("Previewing");
    await expectInPreview(page, "Previewing");
    await expectSaved(page);

    await page.getByRole("button", { name: "Add project" }).click();
    await rowForm(page, "Project name").getByLabel("Project name").fill("Preview Project X");
    await expectInPreview(page, "Preview Project X");
    await expectSaved(page);

    await page.getByRole("button", { name: "Add certification" }).click();
    await rowForm(page, "Certification").getByLabel("Certification", { exact: true }).fill("Certified Previewer");
    await expectInPreview(page, "Certified Previewer");
    await expectSaved(page);

    await page.getByRole("button", { name: "Add language" }).click();
    await rowForm(page, "Language").getByLabel("Language", { exact: true }).fill("Klingon");
    await expectInPreview(page, "Klingon");
    await expectSaved(page);

    await page.getByRole("button", { name: "Add section" }).click();
    const custom = rowForm(page, "Section title");
    await custom.getByLabel("Section title").fill("Publications");
    await custom.getByLabel("Content").fill("Wrote about previews.");
    await expectInPreview(page, "Publications");
    await expectSaved(page);

    const afterSave = await previewText(page);
    await page.reload();
    await showAllPages(page);
    await expect(preview(page)).toContainText("Publications");
    await showAllPages(page);
    const afterReload = await previewText(page);
    let at = 0;
    while (at < afterSave.length && afterSave[at] === afterReload[at]) at++;
    expect(afterReload, `first difference at ${at}: saved-view "…${afterSave.slice(Math.max(0, at - 40), at + 80)}" vs reloaded "…${afterReload.slice(Math.max(0, at - 40), at + 80)}"`).toBe(afterSave);
  });

  test("ticking 'I currently work here' shows Present in the preview straight away and after a reload", async ({ open, account }) => {
    const { page } = await openEditor(open, account.user.id);
    await page.getByRole("button", { name: "Add role" }).click();
    const role = rowForm(page, "Job title");
    await role.getByLabel("Job title").fill("Present Tense Engineer");
    await role.getByLabel("Employer").fill("Nowco");
    await role.getByLabel("Start date").fill("2019-05-01");
    await role.getByLabel("End date").fill("2021-02-01");
    await expectSaved(page);
    await expect(preview(page)).toContainText("Present Tense Engineer");
    await role.getByRole("checkbox").check();
    await expect(preview(page)).toContainText(/Present/i);
    await expectSaved(page);
    await page.reload();
    await expect(preview(page)).toContainText(/Present/i);
  });

  test("hiding and deleting a row take it out of the preview, and showing it brings it back", async ({ open, account }) => {
    const { page } = await openEditor(open, account.user.id);
    await page.getByRole("button", { name: "Add skill" }).click();
    const form = rowForm(page, "Skill");
    await form.getByLabel("Skill", { exact: true }).fill("Vanishing Skill");
    await expectSaved(page);
    await form.getByRole("button", { name: /done/i }).click();
    await expect(preview(page)).toContainText("Vanishing Skill", { timeout: 10_000 });

    const row = () => page.getByText("Vanishing Skill").first().locator("xpath=ancestor::*[.//button[@aria-label='Delete skill']][1]");
    await row().getByRole("button", { name: "Hide from CV" }).click();
    await expect(preview(page)).not.toContainText("Vanishing Skill", { timeout: 10_000 });
    await page.reload();
    await expect(preview(page)).not.toContainText("Vanishing Skill");

    await row().getByRole("button", { name: "Show on CV" }).click();
    await expect(preview(page)).toContainText("Vanishing Skill", { timeout: 10_000 });

    await row().getByRole("button", { name: "Delete skill" }).click();
    await expect(preview(page)).not.toContainText("Vanishing Skill", { timeout: 10_000 });
    await expect(page.getByText("Vanishing Skill")).toHaveCount(0);
  });

  test("a template chosen while typing renders the typed data in the new template", async ({ open, account }) => {
    const { page } = await openEditor(open, account.user.id, { template: "single-navy" });
    await page.getByLabel("Headline").fill("Typed Before The Swap");
    await page.getByRole("button", { name: "Templates" }).click();
    await page.getByRole("button", { name: "Use the Sovereign template" }).click();
    await expect(previewTemplate(page)).toHaveAttribute("data-cv-template", "sovereign");
    await expect(preview(page)).toContainText("Typed Before The Swap");
    await page.getByLabel("Headline").fill("Typed After The Swap");
    await expect(preview(page)).toContainText("Typed After The Swap");
    await expect(previewTemplate(page)).toHaveAttribute("data-cv-template", "sovereign");
    await expectSaved(page);
    await page.reload();
    await expect(previewTemplate(page)).toHaveAttribute("data-cv-template", "sovereign");
    await expect(preview(page)).toContainText("Typed After The Swap");
  });

  test("'What the ATS reads' shows the current data too", async ({ open, account }) => {
    const { page } = await openEditor(open, account.user.id);
    await page.getByLabel("Full name").fill("ATS Text Person");
    await page.getByRole("tab", { name: "What the ATS reads" }).click();
    await expect(page.getByRole("tabpanel").filter({ hasText: "ATS Text Person" })).toBeVisible();
    await page.getByRole("tab", { name: "Recruiter view" }).click();
    await expect(preview(page)).toContainText("ATS Text Person");
  });

  test("the page count and overflow notice follow the content as it grows", async ({ open, account }) => {
    const { page } = await openEditor(open, account.user.id);
    await expect(page.getByText(/Fits on \d pages? \(A4\)/)).toBeVisible();
    const filler = Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of filler text that makes the CV run long enough to need more pages.`).join("\n");
    for (let n = 0; n < 4; n++) {
      await page.getByRole("button", { name: "Add section" }).click();
      const extra = page.locator("form").filter({ has: page.getByLabel("Section title") }).last();
      await extra.getByLabel("Section title").fill(`Extra ${n}`);
      await extra.getByLabel("Content").fill(filler);
      await expectSaved(page);
      await extra.getByRole("button", { name: /done/i }).click();
    }
    await expect(page.getByText(/This CV runs to \d+ pages/)).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText(/This CV runs to \d+ pages/)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("the preview after the data underneath it changes", () => {
  test("restoring an older version shows that version in the preview and the forms, not what was typed before", async ({ open, account }) => {
    const { page, cvId, versionId } = await openEditor(open, account.user.id, { fullName: "Current Version Name" });

    // An older version with clearly different content.
    const { data: older } = await db().from("cv_versions").insert({ cv_id: cvId, user_id: account.user.id, is_current: false, label: "Older draft" }).select("id").single();
    await db().from("cv_personal").insert({ cv_version_id: older!.id, user_id: account.user.id, full_name: "Restored Old Name", headline: "Old Headline", email: "old@example.com" });
    await db().from("cv_summary").insert({ cv_version_id: older!.id, user_id: account.user.id, content: "Old summary that comes back on restore." });
    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("Current Version Name");

    // Type something so a live edit is sitting over the preview when the restore happens.
    await page.getByLabel("Headline").fill("Typed Just Before Restore");
    await expect(preview(page)).toContainText("Typed Just Before Restore");
    await expectSaved(page);

    await page.getByRole("button", { name: "Version history" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Restore" }).first().click();
    await page.keyboard.press("Escape");

    await expect.poll(async () => (await db().from("cv_versions").select("id").eq("cv_id", cvId).eq("is_current", true).single()).data?.id, { timeout: 15_000 }).toBe(older!.id);
    expect(versionId).not.toBe(older!.id);

    // Preview: the restored version, no leftover typing.
    await expect(preview(page)).toContainText("Restored Old Name", { timeout: 15_000 });
    await expect(preview(page)).toContainText("Old summary that comes back on restore.");
    await expect(preview(page)).not.toContainText("Typed Just Before Restore");
    await expect(preview(page)).not.toContainText("Current Version Name");
    // The forms agree with the preview.
    await expect(page.getByLabel("Full name")).toHaveValue("Restored Old Name");
    await expect(page.getByLabel("Headline")).toHaveValue("Old Headline");
    await expect(page.locator("textarea[name='content']").first()).toHaveValue("Old summary that comes back on restore.");
  });
});

test.describe("the mobile preview", () => {
  test("the sheet shows the current data in the selected template", async ({ open, account }) => {
    const { page } = await openEditor(open, account.user.id, { template: "single-navy" }, PHONE);
    await page.getByLabel("Headline").fill("Typed On A Phone");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.locator(".cv-document").first()).toContainText("Typed On A Phone");
    await expect(sheet.locator("[data-cv-template]").first()).toHaveAttribute("data-cv-template", "cambridge");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: /Swap template|Templates/ }).first().click();
    await page.getByRole("button", { name: "Use the Sovereign template" }).click();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByRole("dialog").locator("[data-cv-template]").first()).toHaveAttribute("data-cv-template", "sovereign");
    await expect(page.getByRole("dialog").locator(".cv-document").first()).toContainText("Typed On A Phone");
  });
});
