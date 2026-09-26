import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser } from "../support/test-user";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest, providersMocked } from "../support/cv-fixture";

// The Cover Letter Generator (/dashboard/cover-letters): choose a CV, paste or import a job description, pick tone
// and length, generate a real editable draft grounded only in that CV's content; per-paragraph edit/AI-regenerate
// with autosave and recoverable version history; 4 original templates with a live preview that matches the PDF
// export; copy-as-text; plan gating. Requires the mocked AI/email provider (E2E_MOCK_PROVIDERS=1) — the mock's
// plain-text (non-tool) reply is a fixed sentence ("This is a mocked E2E response...", see mock-agent.mjs), which
// is what a freshly generated letter's one paragraph reads; its structured (tool-call) reply for a paragraph
// regenerate is "Mocked E2E response text." for both the rewritten paragraph and the explanation.

const test = makeCvTest({ name: "Cover Letter Tester", plan: "premium" });
const db = () => getAdminClient();
const SHOTS = path.join("test-results", "cover-letters");

const JOB_DESCRIPTION =
  "We are hiring a Senior Platform Engineer with strong TypeScript, GraphQL and Kubernetes operator experience. " +
  "You will mentor engineers, own reliability, and build internal tooling for a growing UK company.";

test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

async function generateLetter(
  page: Page,
  options: { cvTitle?: string; companyName?: string; jobTitle?: string; tone?: "Formal" | "Conversational"; length?: string } = {},
) {
  await page.goto("/dashboard/cover-letters/new");
  await dismissCookieBanner(page);

  if (options.cvTitle) {
    await page.getByRole("combobox", { name: "CV" }).click();
    await page.getByRole("option", { name: options.cvTitle, exact: true }).click();
  }

  await page.getByLabel("Job description").fill(JOB_DESCRIPTION);
  await page.getByLabel("Company name").fill(options.companyName ?? "Acme Ltd");
  await page.getByLabel("Job title").fill(options.jobTitle ?? "Senior Platform Engineer");

  if (options.tone) {
    await page.getByRole("combobox", { name: "Tone" }).click();
    await page.getByRole("option", { name: options.tone, exact: true }).click();
  }
  if (options.length) {
    await page.getByRole("combobox", { name: "Length" }).click();
    await page.getByRole("option", { name: options.length }).click();
  }

  await page.getByRole("button", { name: "Generate cover letter" }).click();
  await page.waitForURL(/\/dashboard\/cover-letters\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await dismissCookieBanner(page);
  const coverLetterId = page.url().split("/").pop()!;
  return { page, coverLetterId };
}

const versionOf = async (coverLetterId: string) =>
  (await db().from("cover_letter_versions").select("*").eq("cover_letter_id", coverLetterId).eq("is_current", true).single()).data!;
const versionsOf = async (coverLetterId: string) =>
  (await db().from("cover_letter_versions").select("id, is_current, label").eq("cover_letter_id", coverLetterId)).data ?? [];
const paragraphsOf = async (versionId: string) =>
  (await db().from("cover_letter_paragraphs").select("id, content, display_order").eq("version_id", versionId).order("display_order")).data ?? [];
const letterOf = async (coverLetterId: string) => (await db().from("cover_letters").select("*").eq("id", coverLetterId).single()).data!;

test.describe("generating a letter: choosing a CV, JD, tone and length", () => {
  test.skip(!providersMocked, "needs the mocked AI/email provider (E2E_MOCK_PROVIDERS=1)");

  test("the CV you choose, the tone and the length all flow into a real, saved, grounded draft", async ({ open, account }) => {
    // Two CVs with different names — proves the *chosen* one is what the letter is grounded in, not just whichever
    // CV happened to be seeded first.
    await seedCv(account.user.id, { title: "First CV", fullName: "Ada Persist" });
    const second = await seedCv(account.user.id, { title: "Second CV", fullName: "Zara Sample" });

    const page = await open();
    const { coverLetterId } = await generateLetter(page, {
      cvTitle: "Second CV",
      companyName: "Globex Corp",
      jobTitle: "Staff Engineer",
      tone: "Conversational",
      length: "Detailed (~400-500 words)",
    });

    // Sender block on the live preview is pulled from the CV that was actually chosen, not the default/first one.
    await expect(page.getByText("Zara Sample")).toBeVisible();
    await expect(page.getByText("Ada Persist")).toHaveCount(0);
    await expect(page.getByText("Globex Corp").first()).toBeVisible();

    const version = await versionOf(coverLetterId);
    expect(version.tone).toBe("conversational");
    expect(version.length).toBe("detailed");
    expect(version.cv_version_id).toBe(second.versionId);
    // Grounded in the real CV content, not the client's say-so: the snapshot the AI call was actually built from.
    expect(version.cv_text_snapshot).toContain("Zara Sample");
    expect(version.cv_text_snapshot).not.toContain("Ada Persist");

    const paragraphs = await paragraphsOf(version.id);
    expect(paragraphs.length).toBeGreaterThan(0);

    const letter = await letterOf(coverLetterId);
    expect(letter.company_name).toBe("Globex Corp");
    expect(letter.job_title).toBe("Staff Engineer");
    expect(letter.job_description).toBe(JOB_DESCRIPTION); // pasted JD is what was actually sent
    expect(letter.template).toBe("classic-serif"); // default template on a fresh letter
  });

  test("importing the job description from a blocked URL falls back to paste, with a real reason shown", async ({ open, account }) => {
    await seedCv(account.user.id);
    const page = await open();
    await page.goto("/dashboard/cover-letters/new");
    await dismissCookieBanner(page);

    await page.getByRole("tab", { name: "From a link" }).click();
    await page.getByLabel("Job posting link").fill("http://localhost/some-job");
    await page.getByRole("button", { name: "Fetch" }).click();
    await expect(page.getByText(/local address/i)).toBeVisible({ timeout: 10_000 });
    // Falls back to the paste tab so the letter can still be generated by hand.
    await expect(page.getByLabel("Job description")).toBeVisible();
  });
});

test.describe("paragraph editing, AI regeneration, autosave and version history", () => {
  test.skip(!providersMocked, "needs the mocked AI/email provider (E2E_MOCK_PROVIDERS=1)");

  test("editing the generated paragraph updates the live preview immediately and autosaves, surviving a reload", async ({ open, account }) => {
    await seedCv(account.user.id);
    const page = await open();
    const { coverLetterId } = await generateLetter(page, { companyName: "Initech" });

    await page.getByRole("button", { name: "Edit paragraph" }).click();
    const textarea = page.locator("textarea[name='content']");
    await textarea.fill("A distinctively edited opening paragraph for the live preview check.");

    // Live: shows up in the preview before autosave has even settled — driven by editor-preview-context.tsx's
    // setLiveParagraph, independent of the round trip to the server.
    await expect(page.getByText("A distinctively edited opening paragraph").first()).toBeVisible({ timeout: 5_000 });

    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Done" }).click();

    const version = await versionOf(coverLetterId);
    const paragraphs = await paragraphsOf(version.id);
    expect(paragraphs[0].content).toBe("A distinctively edited opening paragraph for the live preview check.");

    await page.reload();
    await dismissCookieBanner(page);
    await expect(page.getByText("A distinctively edited opening paragraph").first()).toBeVisible();
  });

  test("adding a paragraph and regenerating it with AI replaces its content, and the suggestion autosaves once accepted", async ({ open, account }) => {
    await seedCv(account.user.id);
    const page = await open();
    const { coverLetterId } = await generateLetter(page);

    await page.getByRole("button", { name: "Add paragraph" }).click();
    await page.locator("textarea[name='content']").fill("A brand new paragraph, written by hand.");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("A brand new paragraph, written by hand.").first()).toBeVisible();

    await page.getByRole("button", { name: "Edit paragraph" }).nth(1).click();
    await page.getByRole("button", { name: "Regenerate with AI" }).click();
    await expect(page.getByText("Mocked E2E response text.").first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.locator("textarea[name='content']").last()).toHaveValue("Mocked E2E response text.");
    await expect(page.getByText("Saved", { exact: true }).last()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Done" }).last().click();

    const version = await versionOf(coverLetterId);
    const paragraphs = await paragraphsOf(version.id);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1].content).toBe("Mocked E2E response text.");

    // The rewrite was recorded and marked accepted.
    const rewrite = (
      await db().from("cover_letter_paragraph_rewrites").select("status, suggested_text").eq("paragraph_id", paragraphs[1].id).single()
    ).data!;
    expect(rewrite.status).toBe("accepted");
    expect(rewrite.suggested_text).toBe("Mocked E2E response text.");
  });

  test("the first edit checkpoints the letter as it was, version history lists it, and restoring brings the original paragraph back", async ({ open, account }) => {
    await seedCv(account.user.id);
    const page = await open();
    const { coverLetterId } = await generateLetter(page);
    expect(await versionsOf(coverLetterId)).toHaveLength(1);

    const originalVersion = await versionOf(coverLetterId);
    const originalContent = (await paragraphsOf(originalVersion.id))[0].content;

    await page.getByRole("button", { name: "Edit paragraph" }).click();
    await page.locator("textarea[name='content']").fill("The edited paragraph, replacing the generated one.");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Done" }).click();

    await expect.poll(async () => (await versionsOf(coverLetterId)).length, { timeout: 15_000 }).toBe(2);
    const checkpoint = (await versionsOf(coverLetterId)).find((v) => !v.is_current)!;
    expect(checkpoint.label).toMatch(/autosaved/i);
    expect((await paragraphsOf(checkpoint.id))[0].content).toBe(originalContent);

    await page.getByRole("button", { name: "Version history" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Restore" })).toHaveCount(1);
    await dialog.getByRole("button", { name: "Restore" }).click();
    await page.keyboard.press("Escape");

    await expect.poll(async () => (await versionsOf(coverLetterId)).find((v) => v.is_current)?.id, { timeout: 15_000 }).toBe(checkpoint.id);
    await expect(page.getByText(originalContent).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("The edited paragraph, replacing the generated one.")).toHaveCount(0);
  });
});

test.describe("4 templates, live preview, PDF export and copy text", () => {
  test.skip(!providersMocked, "needs the mocked AI/email provider (E2E_MOCK_PROVIDERS=1)");

  test("exactly 4 distinct templates are offered, and switching one updates the live preview immediately and persists", async ({ open, account }) => {
    await seedCv(account.user.id);
    const page = await open();
    const { coverLetterId } = await generateLetter(page);

    await page.getByRole("button", { name: "Change template" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Classic", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Modern", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Minimal", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Bold", { exact: true })).toBeVisible();
    await expect(dialog.locator("button").filter({ has: page.getByText(/^(Classic|Modern|Minimal|Bold)$/) })).toHaveCount(4);

    await dialog.getByText("Modern", { exact: true }).click();
    // Live: the dialog closes and the preview reflects the new template before the persist call even resolves.
    await expect(dialog).toHaveCount(0);

    await expect.poll(async () => (await letterOf(coverLetterId)).template, { timeout: 10_000 }).toBe("modern-block");
    await page.reload();
    await dismissCookieBanner(page);
    await page.getByRole("button", { name: "Change template" }).click();
    await expect(page.getByRole("dialog").getByText("Current", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("dialog").locator("button", { hasText: "Modern" }).filter({ has: page.getByText("Current") }),
    ).toBeVisible();
  });

  test("the exported PDF's real text matches what's on screen, and Copy text copies the same letter", async ({ open, account }) => {
    await seedCv(account.user.id);
    const page = await open();
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await generateLetter(page, { companyName: "Distinctive PDF Co", jobTitle: "Parity Tester" });

    await page.getByRole("button", { name: "Edit paragraph" }).click();
    await page.locator("textarea[name='content']").fill("A distinctive sentence that must appear in both the preview and the exported PDF.");
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("A distinctive sentence that must appear").first()).toBeVisible();

    // Copy text — the clipboard gets exactly the paragraph text currently shown.
    await page.getByRole("button", { name: "Copy text" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain("A distinctive sentence that must appear in both the preview and the exported PDF.");

    // PDF export — same real headless-Chromium pattern as CV export, real selectable text, not a screenshot.
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await page.getByRole("link", { name: "Export PDF" }).click();
    const download = await downloadPromise;
    const pdfPath = path.join(SHOTS, "cover-letter.pdf");
    await download.saveAs(pdfPath);
    const parsed = JSON.parse(execFileSync(process.execPath, [path.join(process.cwd(), "e2e/support/pdf-text.mjs"), pdfPath], { encoding: "utf8" }));
    expect(parsed.text).toContain("Distinctive PDF Co");
    // The classic-serif template's "Re: <role>" line is styled uppercase (a CSS text-transform), which real
    // extracted PDF text reflects too — same layer visible in the app's own on-screen preview, not a defect.
    expect(parsed.text).toMatch(/parity tester/i);
    expect(parsed.text).toContain("A distinctive sentence that must appear in both the preview and the exported PDF.");
  });
});

test.describe("plan gating", () => {
  test.skip(!providersMocked, "needs the mocked AI/email provider (E2E_MOCK_PROVIDERS=1)");

  test("the Free plan is blocked from generating a cover letter, with a clear reason, and nothing persisted", async ({ browser }) => {
    const free = await createIsolatedUser({ fullName: "Free Cover Letter Tester" });
    try {
      await markOnboarded(free.id);
      await seedCv(free.id);
      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", viewport: { width: 1360, height: 900 } });
      const page = await context.newPage();
      await page.goto("/login");
      await page.getByLabel("Email").fill(free.email);
      await page.getByLabel("Password", { exact: true }).fill(free.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/dashboard$/);

      await page.goto("/dashboard/cover-letters/new");
      await dismissCookieBanner(page);
      await page.getByLabel("Job description").fill(JOB_DESCRIPTION);
      await page.getByLabel("Company name").fill("Free Plan Co");
      await page.getByLabel("Job title").fill("Blocked Role");
      await page.getByRole("button", { name: "Generate cover letter" }).click();

      await expect(page.getByRole("alert").filter({ hasText: /plan|upgrade|included/i })).toBeVisible({ timeout: 20_000 });
      expect((await db().from("cover_letters").select("id").eq("user_id", free.id)).data).toHaveLength(0);
      await context.close();
    } finally {
      await deleteIsolatedUser(free.id);
    }
  });
});
