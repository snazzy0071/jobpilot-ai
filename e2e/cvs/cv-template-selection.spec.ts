import { test as base, expect, type Browser, type Page, type Route } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { markOnboarded, setPlan } from "../support/roles";
import { seedCv } from "../support/cv";
import { CV_TEMPLATES } from "../../src/config/cv-templates";

// Choosing a CV template, all the way through: every one of the 24 templates can be picked in the chooser, the
// preview and the "current template" card switch immediately (before the database answers), the choice is written
// to the CV's row, and it is still selected after a reload. Only selection is covered here — not PDF/export.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DESKTOP = { width: 1360, height: 900 };

type Account = { user: IsolatedUser; state: string };

const test = base.extend<{ open: () => Promise<Page> }, { account: Account }>({
  // One account for the file, signed in once (the login endpoint is rate limited per IP).
  account: [
    async ({ browser }, use) => {
      const user = await createIsolatedUser({ fullName: "CV Template Tester" });
      await markOnboarded(user.id);
      await setPlan(user.id, "pro"); // all 24 templates are a paid-plan allowance (Free gets 3)
      const state = `test-results/.cv-template-${user.id}.json`;
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
const storedTemplate = async (cvId: string) => (await db().from("cvs").select("template").eq("id", cvId).single()).data?.template;
const saveState = (page: Page) => page.locator("[data-save-state]");
const summary = (page: Page) => page.locator("[data-current-template]");
const previewTemplate = (page: Page) => page.locator("[data-cv-template]").first();
const isServerAction = (request: { method: () => string; headers: () => Record<string, string> }) =>
  request.method() === "POST" && "next-action" in request.headers();

async function openEditor(open: () => Promise<Page>, cvId: string) {
  const page = await open();
  await page.goto(`/dashboard/cvs/${cvId}`);
  await expect(summary(page)).toBeVisible();
  // The cookie banner is fixed to the bottom of the viewport; dismiss it so it can't sit over anything.
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
  return page;
}

async function choose(page: Page, name: string) {
  await page.getByRole("button", { name: "Templates" }).click();
  await page.getByRole("button", { name: `Use the ${name} template` }).click();
}

test.describe("template selection", () => {
  test("all 24 templates: preview switches at once, the row is updated, and it is still selected after a reload", async ({ open, account }) => {
    test.setTimeout(10 * 60_000);
    expect(CV_TEMPLATES).toHaveLength(24);
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" });
    const page = await openEditor(open, cvId);

    for (const template of CV_TEMPLATES) {
      await choose(page, template.name);

      // Immediate — nothing here waits for the database.
      await expect(previewTemplate(page), `${template.slug}: preview`).toHaveAttribute("data-cv-template", template.slug, { timeout: 2_000 });
      await expect(summary(page), `${template.slug}: current-template card`).toHaveAttribute("data-current-template", template.slug, { timeout: 2_000 });

      // Then the database, and the header's honest state.
      await expect.poll(() => storedTemplate(cvId), { message: `${template.slug}: stored`, timeout: 15_000 }).toBe(template.slug);
      await expect(saveState(page)).toHaveAttribute("data-save-state", "saved", { timeout: 15_000 });

      // Survives a reload.
      await page.reload();
      await expect(summary(page), `${template.slug}: after reload`).toHaveAttribute("data-current-template", template.slug);
      await expect(previewTemplate(page), `${template.slug}: preview after reload`).toHaveAttribute("data-cv-template", template.slug);
    }
  });

  test("the chooser marks the current template, and reopening it changes nothing", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "sovereign" });
    const page = await openEditor(open, cvId);
    await page.getByRole("button", { name: "Templates" }).click();
    await expect(page.getByRole("button", { name: "Sovereign is your current template" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use the Sovereign template" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(summary(page)).toHaveAttribute("data-current-template", "sovereign");
    await expect(saveState(page)).not.toHaveAttribute("data-save-state", "error");
    expect(await storedTemplate(cvId)).toBe("sovereign");
  });

  test("a choice made through the chooser's filters is the template that gets saved", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" });
    const page = await openEditor(open, cvId);
    await page.getByRole("button", { name: "Templates" }).click();
    await page.getByRole("group", { name: "Filter templates by category" }).getByRole("button", { name: "Legal" }).click();
    await page.getByRole("button", { name: "Use the Sovereign template" }).click();
    await expect(previewTemplate(page)).toHaveAttribute("data-cv-template", "sovereign");
    await expect.poll(() => storedTemplate(cvId), { timeout: 15_000 }).toBe("sovereign");
  });

  test("leaving the editor straight after choosing still saves the choice", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" });
    const page = await openEditor(open, cvId);
    await choose(page, "Boardroom");
    await page.getByRole("link", { name: "All CVs" }).click(); // no waiting for the save
    await page.waitForURL(/\/dashboard\/cvs$/);
    await expect.poll(() => storedTemplate(cvId), { timeout: 15_000 }).toBe("boardroom");
    await page.goto(`/dashboard/cvs/${cvId}`);
    await expect(summary(page)).toHaveAttribute("data-current-template", "boardroom");
  });

  test("a CV created with a chosen template opens on that template", async ({ open }) => {
    const page = await open();
    await page.goto("/dashboard/cvs");
    await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
    await page.getByRole("button", { name: "New CV" }).first().click();
    await page.getByLabel("Title").fill("Created With Terminal");
    await page.getByLabel("Template").click();
    await page.getByRole("option", { name: /^Terminal/ }).click();
    await page.getByRole("button", { name: "Create CV" }).click();
    await page.waitForURL(/\/dashboard\/cvs\/[0-9a-f-]{36}$/);
    const cvId = page.url().split("/").pop()!;
    expect(await storedTemplate(cvId)).toBe("terminal");
    await expect(summary(page)).toHaveAttribute("data-current-template", "terminal");
    await expect(previewTemplate(page)).toHaveAttribute("data-cv-template", "terminal");
  });

  test("a save that can't reach the server is shown, the preview goes back to what is stored, and choosing again works", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" }); // = cambridge
    const page = await openEditor(open, cvId);
    await expect(summary(page)).toHaveAttribute("data-current-template", "cambridge");

    let fail = true;
    await page.route("**/dashboard/cvs/**", async (route: Route) => {
      if (fail && isServerAction(route.request())) await route.abort();
      else await route.continue();
    });

    await choose(page, "Sovereign");
    await expect(saveState(page)).toHaveAttribute("data-save-state", "error", { timeout: 15_000 });
    await expect(summary(page)).toHaveAttribute("data-current-template", "cambridge"); // not left showing an unsaved template
    await expect(previewTemplate(page)).toHaveAttribute("data-cv-template", "cambridge");
    expect(await storedTemplate(cvId)).toBe("single-navy");

    fail = false;
    await choose(page, "Sovereign");
    await expect.poll(() => storedTemplate(cvId), { timeout: 15_000 }).toBe("sovereign");
    await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
    await page.reload();
    await expect(summary(page)).toHaveAttribute("data-current-template", "sovereign");
  });

  test("rapid switching ends on the last choice, in the preview, the database and after a reload", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" });
    const page = await openEditor(open, cvId);
    for (const name of ["Sovereign", "Boardroom", "Terminal", "Oxford"]) await choose(page, name);
    await expect(previewTemplate(page)).toHaveAttribute("data-cv-template", "oxford");
    await expect.poll(() => storedTemplate(cvId), { timeout: 20_000 }).toBe("oxford");
    await page.reload();
    await expect(summary(page)).toHaveAttribute("data-current-template", "oxford");
  });

  test("a template chosen in one tab is what another tab shows when it is opened", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" });
    const first = await openEditor(open, cvId);
    await choose(first, "Atlas");
    await expect.poll(() => storedTemplate(cvId), { timeout: 15_000 }).toBe("atlas");
    const second = await openEditor(open, cvId);
    await expect(summary(second)).toHaveAttribute("data-current-template", "atlas");
  });
});
