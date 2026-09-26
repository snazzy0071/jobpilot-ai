import { execFileSync } from "node:child_process";
import path from "node:path";
import { test as base, expect, type Browser, type Page, type Route } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { markOnboarded, setPlan } from "../support/roles";
import { databaseKnowsNewTemplates, seedCv } from "../support/cv";

// The CV builder's promises, tested against the real app, database and PDF
// renderer: an edit is saved and comes back after a reload; a template
// choice is stored on the CV and restored; a failed save is shown rather
// than swallowed; and the exported PDF is drawn from the same template and
// the same data as the preview.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const DESKTOP = { width: 1360, height: 900 };

type Account = { user: IsolatedUser; state: string };

const test = base.extend<{ open: (viewport?: { width: number; height: number }) => Promise<Page> }, { account: Account }>({
  // One account for the file, signed in once (the login endpoint is rate limited per IP).
  account: [
    async ({ browser }, use) => {
      const user = await createIsolatedUser({ fullName: "CV Persist Tester" });
      await markOnboarded(user.id);
      await setPlan(user.id, "pro"); // template choice is limited on Free (cv_template_count), and these specs switch templates
      const state = `test-results/.cv-persist-${user.id}.json`;
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
        await deleteIsolatedUser(user.id); // cascades to every CV, version and section row it owns
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
const isServerAction = (request: { method: () => string; headers: () => Record<string, string> }) =>
  request.method() === "POST" && "next-action" in request.headers();

function pdfText(file: string): { text: string; pages: number } {
  const output = execFileSync(process.execPath, [path.join(process.cwd(), "e2e/support/pdf-text.mjs"), file], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(output) as { text: string; pages: number };
}

const words = (text: string) => new Set((text.toLowerCase().match(/[a-z0-9']{4,}/g) ?? []).filter((word) => !/^\d+$/.test(word) || word.length === 4));

test.describe("edits save reliably", () => {
  test("edit → saved → reload restores it, and the preview updated immediately", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id);
    const page = await open();
    await page.goto(`/dashboard/cvs/${cvId}`);

    await page.getByLabel("Full name").fill("Ada Persist Edited");
    await page.getByLabel("Headline").fill("Principal Engineer");

    // Live preview first, before any save has necessarily completed.
    await expect(page.locator(".cv-document").first()).toContainText("Ada Persist Edited");

    // The database really has it, and the header reports the truth.
    await expect
      .poll(async () => (await db().from("cv_personal").select("full_name, headline").eq("cv_version_id", versionId).single()).data)
      .toEqual({ full_name: "Ada Persist Edited", headline: "Principal Engineer" });
    await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");

    await page.reload();
    await expect(page.getByLabel("Full name")).toHaveValue("Ada Persist Edited");
    await expect(page.getByLabel("Headline")).toHaveValue("Principal Engineer");
    await expect(page.locator(".cv-document").first()).toContainText("Principal Engineer");
  });

  test("an edit typed while a new row's first save is still in flight updates that row (no duplicate)", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id);
    const page = await open();
    // Hold every save open for a while so the second edit is guaranteed to land while the first insert is in flight.
    await page.route("**/dashboard/cvs/**", async (route: Route) => {
      if (isServerAction(route.request())) await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto(`/dashboard/cvs/${cvId}`);

    await page.getByRole("button", { name: "Add role" }).click();
    const roleForm = page.locator("form").filter({ has: page.getByLabel("Job title") });
    await roleForm.getByLabel("Job title").fill("Duplicate Probe Engineer");
    await roleForm.getByLabel("Employer").fill("Probe Ltd");
    await roleForm.getByLabel("Start date").fill("2022-01-01");
    await page.waitForTimeout(1100); // debounce elapsed: the insert is now in flight (held open above)
    await roleForm.locator("textarea[name='description']").fill("Second edit, made during the first save");

    await expect
      .poll(async () => {
        const { data } = await db().from("cv_experience").select("description").eq("cv_version_id", versionId).eq("job_title", "Duplicate Probe Engineer");
        return data;
      }, { timeout: 20_000 })
      .toEqual([{ description: "Second edit, made during the first save" }]); // exactly one row, holding the latest text
    await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
  });

  test("leaving the page inside the debounce window still saves the edit", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id);
    const page = await open();
    await page.goto(`/dashboard/cvs/${cvId}`);

    await page.getByLabel("Headline").fill("Saved on the way out");
    await page.getByRole("link", { name: "All CVs" }).click(); // well inside the 800ms debounce
    await page.waitForURL(/\/dashboard\/cvs$/);

    await expect
      .poll(async () => (await db().from("cv_personal").select("headline").eq("cv_version_id", versionId).single()).data?.headline)
      .toBe("Saved on the way out");
  });

  test("a failed save is shown as an error (never stuck on Saving), and the next attempt saves", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id);
    const page = await open();
    await page.goto(`/dashboard/cvs/${cvId}`);

    await page.route("**/dashboard/cvs/**", async (route) => {
      if (isServerAction(route.request())) await route.abort("failed");
      else await route.continue();
    });
    await page.getByLabel("Headline").fill("This save will fail");

    await expect(saveState(page)).toHaveAttribute("data-save-state", "error", { timeout: 15_000 });
    await expect(saveState(page)).toContainText("Couldn't reach the server");
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't reach the server" }).first()).toBeVisible();
    expect((await db().from("cv_personal").select("headline").eq("cv_version_id", versionId).single()).data?.headline).toBe("Senior Platform Engineer");

    await page.unroute("**/dashboard/cvs/**");
    await page.getByLabel("Headline").fill("This one goes through");
    await expect
      .poll(async () => (await db().from("cv_personal").select("headline").eq("cv_version_id", versionId).single()).data?.headline)
      .toBe("This one goes through");
    await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
  });
});

test.describe("template selection persists per CV", () => {
  test("reopening a CV restores its stored template in the editor and the preview", async ({ open, account }) => {
    const cases: [string, string][] = [
      ["single-forest", "lakeland"],
      ["sidebar-slate", "meridian"],
    ];
    for (const [stored, expected] of cases) {
      const { cvId } = await seedCv(account.user.id, { template: stored });
      const page = await open();
      await page.goto(`/dashboard/cvs/${cvId}`);
      await expect(page.locator("[data-current-template]")).toHaveAttribute("data-current-template", expected);
      await expect(page.locator("[data-cv-template]").first()).toHaveAttribute("data-cv-template", expected);
      await page.reload();
      await expect(page.locator("[data-current-template]")).toHaveAttribute("data-current-template", expected);
    }
  });

  test("template A → B → reload (or, if the database can't store it, the failure is shown and the preview reverts)", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" }); // = cambridge
    const supportsNew = await databaseKnowsNewTemplates(account.user.id);
    const page = await open();
    await page.goto(`/dashboard/cvs/${cvId}`);
    const summary = page.locator("[data-current-template]");
    const previewTemplate = () => page.locator("[data-cv-template]").first();
    await expect(summary).toHaveAttribute("data-current-template", "cambridge");

    const choose = async (name: string) => {
      await page.getByRole("button", { name: "Templates" }).click();
      await page.getByRole("button", { name: `Use the ${name} template` }).click();
    };

    if (supportsNew) {
      await choose("Sovereign");
      // Immediate: no waiting on the database.
      await expect(previewTemplate()).toHaveAttribute("data-cv-template", "sovereign");
      await expect(summary).toHaveAttribute("data-current-template", "sovereign");
      await expect.poll(async () => (await db().from("cvs").select("template").eq("id", cvId).single()).data?.template).toBe("sovereign");
      await expect(saveState(page)).toHaveAttribute("data-save-state", "saved");
      await page.reload();
      await expect(summary).toHaveAttribute("data-current-template", "sovereign");
      await expect(previewTemplate()).toHaveAttribute("data-cv-template", "sovereign");

      await choose("Terminal");
      await expect(previewTemplate()).toHaveAttribute("data-cv-template", "terminal");
      await expect.poll(async () => (await db().from("cvs").select("template").eq("id", cvId).single()).data?.template).toBe("terminal");
      await page.reload();
      await expect(summary).toHaveAttribute("data-current-template", "terminal");
    } else {
      test.info().annotations.push({ type: "note", description: "migrations 0088/0089 not applied here: verifying the failure path instead" });
      await choose("Sovereign");
      // The preview must not keep showing a template the database refused...
      await expect(summary).toHaveAttribute("data-current-template", "cambridge", { timeout: 15_000 });
      await expect(previewTemplate()).toHaveAttribute("data-cv-template", "cambridge");
      // ...and the reason is on screen, not swallowed.
      await expect(saveState(page)).toHaveAttribute("data-save-state", "error");
      await expect(saveState(page)).toContainText("isn't available on the server yet");
      expect((await db().from("cvs").select("template").eq("id", cvId).single()).data?.template).toBe("single-navy");
    }
  });

  test("rapid switching A → B → C ends on C in the database", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" });
    test.skip(!(await databaseKnowsNewTemplates(account.user.id)), "migrations 0088/0089 not applied to this database");
    const page = await open();
    await page.goto(`/dashboard/cvs/${cvId}`);
    for (const name of ["Sovereign", "Boardroom", "Terminal"]) {
      await page.getByRole("button", { name: "Templates" }).click();
      await page.getByRole("button", { name: `Use the ${name} template` }).click();
    }
    await expect.poll(async () => (await db().from("cvs").select("template").eq("id", cvId).single()).data?.template).toBe("terminal");
    await page.reload();
    await expect(page.locator("[data-current-template]")).toHaveAttribute("data-current-template", "terminal");
  });
});

test.describe("PDF export matches the preview", () => {
  test("the PDF is drawn from the same template, version and data the preview shows", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id, { template: "single-navy" }); // cambridge
    const page = await open();
    await page.goto(`/dashboard/cvs/${cvId}`);
    await expect(page.locator(".cv-document").first()).toContainText("Marlow Tech");

    // Edit, then export straight away: the export must wait for the save.
    await page.getByLabel("Headline").fill("Exported Headline Marker");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.pdf$/i);
    const { text, pages } = pdfText((await file.path())!);

    // 1. Same data — including the edit that was still unsaved when the button was pressed.
    expect(text).toContain("Ada Persist");
    expect(text).toContain("Exported Headline Marker");
    expect(text).toContain("Marlow Tech");
    expect(text).toContain("Northbridge University");
    expect(text).toContain("TypeScript");

    // 2. Every word the preview shows is in the PDF (and in the same order for the landmarks).
    const previewText = await page.locator(".cv-document").first().innerText();
    const inPdf = words(text);
    const missing = [...words(previewText)].filter((word) => !inPdf.has(word));
    expect(missing, `words in the preview but not in the PDF: ${missing.slice(0, 12).join(", ")}`).toEqual([]);
    const order = ["Ada Persist", "Exported Headline Marker", "Marlow Tech", "Northbridge Partners", "Northbridge University"];
    const positions = order.map((needle) => text.indexOf(needle));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    // 3. Same page count as the preview reports.
    const previewPages = Number(/Fits on (\d+) page/.exec(await page.locator("[role=status]", { hasText: "Fits on" }).innerText())?.[1]);
    expect(pages).toBe(previewPages);

    // 4. The server says which template and version it rendered, and they are the preview's.
    const response = await page.request.get(`/api/cvs/${cvId}/export?template=cambridge`);
    expect(response.status()).toBe(200);
    expect(response.headers()["x-cv-template"]).toBe("cambridge");
    expect(response.headers()["x-cv-version"]).toBe(versionId);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    await expect(page.locator("[data-cv-template]").first()).toHaveAttribute("data-cv-template", "cambridge");
  });

  test("the export refuses to produce a PDF in a different template from the one being previewed", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" }); // cambridge in the database
    const page = await open();
    await page.goto(`/dashboard/cvs/${cvId}`);
    const response = await page.request.get(`/api/cvs/${cvId}/export?template=oxford`);
    expect(response.status()).toBe(409);
    expect((await response.json()).error).toContain("hasn't finished saving");
  });

  test("different templates produce different PDFs from the same data", async ({ open, account }) => {
    const a = await seedCv(account.user.id, { template: "single-navy" }); // cambridge
    const b = await seedCv(account.user.id, { template: "band-navy" }); // boardroom
    const page = await open();
    const bytes = async (cvId: string, template: string) => {
      const response = await page.request.get(`/api/cvs/${cvId}/export?template=${template}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["x-cv-template"]).toBe(template);
      return response.body();
    };
    const [first, second] = [await bytes(a.cvId, "cambridge"), await bytes(b.cvId, "boardroom")];
    expect(first.equals(second)).toBe(false);
  });

  test("export after a template change uses the new template", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id, { template: "single-navy" });
    test.skip(!(await databaseKnowsNewTemplates(account.user.id)), "migrations 0088/0089 not applied to this database");
    const page = await open();
    await page.goto(`/dashboard/cvs/${cvId}`);
    await page.getByRole("button", { name: "Templates" }).click();
    await page.getByRole("button", { name: "Use the Sovereign template" }).click();

    // Export immediately, without waiting for the save to be visible: the export flushes it first.
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF", exact: true }).click();
    await download;
    const response = await page.request.get(`/api/cvs/${cvId}/export?template=sovereign`);
    expect(response.headers()["x-cv-template"]).toBe("sovereign");
    expect((await db().from("cvs").select("template").eq("id", cvId).single()).data?.template).toBe("sovereign");
  });
});
