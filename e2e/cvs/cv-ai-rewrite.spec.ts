import { expect, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, expectSaved, makeCvTest, openSeededEditor, previewDoc, providersMocked, rowForm } from "../support/cv-fixture";

// AI summary and bullet rewrites: ask → review the suggestion → accept (or reject) → the CV is updated, saved, shown
// in the preview and still there after a reload. Run against a server with the AI provider mocked
// (E2E_MOCK_PROVIDERS=1) — no real model is called and nothing is billed.

const test = makeCvTest({ name: "CV AI Tester", plan: "elite" });
const db = () => getAdminClient();
test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

const SUGGESTION = "Mocked E2E response text."; // what the mock provider returns for any text field
const summaryBox = (page: Page) => page.locator("textarea[name='content']").first();

test.describe("summary rewrite", () => {
  test("ask → suggestion shown beside the original → accept: the summary is replaced, saved, previewed and survives a reload", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    const original = await summaryBox(page).inputValue();
    expect(original.length).toBeGreaterThan(20);

    await page.getByRole("button", { name: "Rewrite with AI" }).first().click();
    await expect(page.getByText("Thinking of a stronger version…")).toBeVisible();
    const suggestionPane = page.locator("div").filter({ has: page.getByText("Suggestion", { exact: true }) }).filter({ hasText: SUGGESTION }).last();
    await expect(suggestionPane).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Original", { exact: true }).first()).toBeVisible();
    // Nothing changes until the user accepts.
    expect(await summaryBox(page).inputValue()).toBe(original);

    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(summaryBox(page)).toHaveValue(SUGGESTION);
    await expect(previewDoc(page)).toContainText(SUGGESTION);
    await expect.poll(async () => (await db().from("cv_summary").select("content").eq("cv_version_id", versionId).single()).data?.content, { timeout: 15_000 }).toBe(SUGGESTION);
    await expectSaved(page);

    await expect.poll(async () => (await db().from("ats_rewrites").select("status, section_key").eq("cv_version_id", versionId)).data, { timeout: 15_000 }).toEqual([{ status: "accepted", section_key: "summary" }]);

    await page.reload();
    await expect(summaryBox(page)).toHaveValue(SUGGESTION);
    await expect(previewDoc(page)).toContainText(SUGGESTION);
  });

  test("reject: the summary is left exactly as it was, and the suggestion is recorded as rejected", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    const original = await summaryBox(page).inputValue();
    await page.getByRole("button", { name: "Rewrite with AI" }).first().click();
    await expect(page.getByRole("button", { name: "Reject" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByRole("button", { name: "Rewrite with AI" }).first()).toBeVisible();
    expect(await summaryBox(page).inputValue()).toBe(original);
    await expect.poll(async () => (await db().from("ats_rewrites").select("status").eq("cv_version_id", versionId)).data, { timeout: 15_000 }).toEqual([{ status: "rejected" }]);
    expect((await db().from("cv_summary").select("content").eq("cv_version_id", versionId).single()).data?.content).toBe(original);
  });

  test("an empty summary says what to do, instead of doing nothing", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    await summaryBox(page).fill("");
    await page.getByRole("button", { name: "Rewrite with AI" }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: /write a few words first/i })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("button", { name: "Rewrite with AI" }).first()).toBeVisible();
  });

  test("accepting, then typing more, keeps the accepted text plus the new typing (the form isn't left showing the old text)", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    await page.getByRole("button", { name: "Rewrite with AI" }).first().click();
    await expect(page.getByRole("button", { name: "Accept", exact: true })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expectSaved(page);
    await summaryBox(page).press("End");
    await page.keyboard.type(" And more.");
    await expect.poll(async () => (await db().from("cv_summary").select("content").eq("cv_version_id", versionId).single()).data?.content, { timeout: 15_000 }).toBe(`${SUGGESTION} And more.`);
  });
});

test.describe("experience bullet rewrite", () => {
  test("ask → accept: the role's description is replaced, saved, previewed and survives a reload", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    await page.getByRole("button", { name: "Edit role" }).first().click();
    const form = rowForm(page, "Job title");
    const description = form.locator("textarea[name='description']");
    const original = await description.inputValue();
    expect(original.length).toBeGreaterThan(10);

    await form.getByRole("button", { name: "Rewrite bullets with AI" }).click();
    await expect(form.getByRole("button", { name: "Accept", exact: true })).toBeVisible({ timeout: 20_000 });
    // The suggestion is shown in its own pane; that exact text is what must end up in the CV.
    const suggestion = (await form.getByText("Suggestion", { exact: true }).locator("xpath=following-sibling::p[1]").innerText()).trim();
    expect(suggestion).toContain(SUGGESTION);
    expect(await description.inputValue()).toBe(original);
    await form.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(description).toHaveValue(suggestion);
    await expect(previewDoc(page)).toContainText(SUGGESTION);
    await expect
      .poll(async () => (await db().from("cv_experience").select("description").eq("cv_version_id", versionId).eq("job_title", "Senior Platform Engineer").single()).data?.description, { timeout: 15_000 })
      .toBe(suggestion);
    await expectSaved(page);
    await expect.poll(async () => (await db().from("ats_rewrites").select("status").eq("cv_version_id", versionId)).data, { timeout: 15_000 }).toEqual([{ status: "accepted" }]);

    await page.reload();
    await expect(previewDoc(page)).toContainText(SUGGESTION);
  });
});

test.describe("plan limits", () => {
  test("on the Free plan the rewrite explains the limit, changes nothing and doesn't spend anything", async ({ browser }) => {
    const free = await createIsolatedUser({ fullName: "Free AI Tester" });
    try {
      await markOnboarded(free.id);
      const { cvId, versionId } = await seedCv(free.id);
      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", viewport: { width: 1360, height: 900 } });
      const page = await context.newPage();
      await page.goto("/login");
      await page.getByLabel("Email").fill(free.email);
      await page.getByLabel("Password", { exact: true }).fill(free.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/dashboard$/);
      await page.goto(`/dashboard/cvs/${cvId}`);
      await dismissCookieBanner(page);
      const original = await summaryBox(page).inputValue();
      await page.getByRole("button", { name: "Rewrite with AI" }).first().click();
      await expect(page.getByRole("alert").filter({ hasText: /plan|upgrade|limit|available/i }).first()).toBeVisible({ timeout: 20_000 });
      expect(await summaryBox(page).inputValue()).toBe(original);
      expect((await db().from("ats_rewrites").select("id").eq("cv_version_id", versionId)).data).toHaveLength(0);
      await context.close();
    } finally {
      await deleteIsolatedUser(free.id);
    }
  });
});
