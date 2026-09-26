import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { dismissCookieBanner, expectSaved, makeCvTest, openSeededEditor, previewDoc, providersMocked } from "../support/cv-fixture";

// The ATS pre-flight panel in the editor: the deterministic format checks (no AI), a scored scan against a job
// description that is stored and comes back after a reload, and the fixes it offers — add a missing skill, rework
// the summary or a role for a keyword — each of which must change the CV, save, and leave the editor consistent.
// The AI provider is mocked (E2E_MOCK_PROVIDERS=1); its scan response carries one keyword of each fix kind.

const test = makeCvTest({ name: "CV ATS Tester", plan: "elite" });
const db = () => getAdminClient();

const JOB_DESCRIPTION =
  "We are hiring a Senior Platform Engineer with strong TypeScript, GraphQL and Kubernetes operator experience. " +
  "You will mentor engineers, own reliability, and build internal tooling for a growing UK company.";

const summaryBox = (page: Page) => page.locator("textarea[name='content']").first();

async function runScan(page: Page) {
  await page.getByLabel("Paste a job description").fill(JOB_DESCRIPTION);
  await page.getByRole("button", { name: "Run ATS scan" }).click();
  await expect(page.getByRole("button", { name: "Re-score" })).toBeVisible({ timeout: 30_000 });
}

test.describe("format checks (no AI)", () => {
  test("an empty CV immediately lists its real gaps, and they clear as the CV is filled in", async ({ open, account }) => {
    const { page } = await openSeededEditor(open, account.user.id);
    await page.getByLabel("Full name").fill("");
    await page.locator("textarea[name='content']").first().fill("");
    await expect(page.getByText(/add your full name/i)).toBeVisible();
    await expect(page.getByText(/add a professional summary/i)).toBeVisible();
    await page.getByLabel("Full name").fill("Filled In Person");
    await expect(page.getByText(/add your full name/i)).toHaveCount(0);
    await page.locator("textarea[name='content']").first().fill("A summary that is long enough to count as a real professional summary for the checker.");
    await expect(page.getByText(/add a professional summary/i)).toHaveCount(0);
  });
});

test.describe("scan", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("a scan returns scores and keyword feedback, is stored against the version, and is still there after a reload", async ({ open, account }) => {
    const { page, versionId, cvId } = await openSeededEditor(open, account.user.id);
    await runScan(page);
    await expect(page.getByText(/\d{1,3}\s*\/\s*100/).first()).toBeVisible();
    await expect(page.getByText("GraphQL").first()).toBeVisible();
    await expect(page.getByText("Kubernetes operators").first()).toBeVisible();

    const { data: scans } = await db().from("ats_scans").select("id, job_description, cv_text_snapshot, match_score, cv_version_id").eq("cv_version_id", versionId);
    expect(scans).toHaveLength(1);
    expect(scans![0].job_description).toBe(JOB_DESCRIPTION);
    expect(scans![0].cv_text_snapshot).toContain("Ada Persist"); // the scan read this CV, not an empty one
    const { data: keywords } = await db().from("ats_keywords").select("keyword, status").eq("scan_id", scans![0].id);
    expect(keywords).toEqual(expect.arrayContaining([expect.objectContaining({ keyword: "GraphQL", status: "missing" }), expect.objectContaining({ keyword: "TypeScript", status: "matched" })]));

    // The score is kept on the version and shown on the CV's card in the list.
    await expect.poll(async () => (await db().from("cv_versions").select("ats_score").eq("id", versionId).single()).data?.ats_score, { timeout: 15_000 }).toBe(scans![0].match_score);
    await page.reload();
    await expect(page.getByRole("button", { name: "Re-score" })).toBeVisible();
    await expect(page.getByText("GraphQL").first()).toBeVisible();
    await page.goto("/dashboard/cvs");
    await expect(page.getByText(`${scans![0].match_score}/100`).first()).toBeVisible();
    expect(cvId).toBeTruthy();
  });

  test("Re-score scans the CV as it is now", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    await runScan(page);
    await page.getByLabel("Headline").fill("Freshly Edited Headline");
    await expectSaved(page);
    await page.getByRole("button", { name: "Re-score" }).click();
    await expect.poll(async () => (await db().from("ats_scans").select("cv_text_snapshot").eq("cv_version_id", versionId).order("created_at", { ascending: false }).limit(1).single()).data?.cv_text_snapshot, { timeout: 30_000 }).toContain("Freshly Edited Headline");
  });
});

test.describe("fixes offered by a scan", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("'Add to Skills' adds the missing skill to the CV, saved, in the preview, after a reload", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    await runScan(page);
    await page.getByRole("button", { name: "Add to Skills" }).first().click();
    await expect.poll(async () => (await db().from("cv_skills").select("name").eq("cv_version_id", versionId).eq("name", "GraphQL")).data, { timeout: 20_000 }).toEqual([{ name: "GraphQL" }]);
    await expect(previewDoc(page)).toContainText("GraphQL", { timeout: 15_000 });
    await page.reload();
    await expect(previewDoc(page)).toContainText("GraphQL");
    expect((await db().from("cv_skills").select("id").eq("cv_version_id", versionId).eq("name", "GraphQL")).data).toHaveLength(1); // once, not twice
  });

  test("summary keyword rewrite: suggest → accept updates the summary everywhere, and the form doesn't keep the old text", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    await runScan(page);
    const item = page.locator("li").filter({ hasText: "Kubernetes operators" }).first();
    await item.getByRole("button", { name: "Suggest rewrite" }).click();
    await expect(item.getByText("Suggestion", { exact: true })).toBeVisible({ timeout: 20_000 });
    await item.getByRole("button", { name: "Accept", exact: true }).click();

    const suggestion = "Mocked E2E response text.";
    await expect.poll(async () => (await db().from("cv_summary").select("content").eq("cv_version_id", versionId).single()).data?.content, { timeout: 30_000 }).toBe(suggestion);
    await expect(previewDoc(page)).toContainText(suggestion);
    await expect.poll(async () => (await db().from("ats_rewrites").select("status").eq("cv_version_id", versionId)).data, { timeout: 15_000 }).toEqual([{ status: "accepted" }]);
    // The summary box now shows the accepted text — otherwise the next keystroke there would save the old text over it.
    await expect(summaryBox(page)).toHaveValue(suggestion);
    await summaryBox(page).press("End");
    await page.keyboard.type(" More.");
    await expect.poll(async () => (await db().from("cv_summary").select("content").eq("cv_version_id", versionId).single()).data?.content, { timeout: 15_000 }).toBe(`${suggestion} More.`);
  });

  test("role keyword rewrite: suggest → accept updates the role, saved, previewed and after a reload", async ({ open, account }) => {
    const { page, versionId } = await openSeededEditor(open, account.user.id);
    await runScan(page);
    const item = page.locator("li").filter({ hasText: "mentoring" }).first();
    await item.getByRole("button", { name: "Suggest rewrite" }).click();
    await expect(item.getByText("Suggestion", { exact: true })).toBeVisible({ timeout: 20_000 });
    await item.getByRole("button", { name: "Accept", exact: true }).click();

    await expect
      .poll(async () => (await db().from("cv_experience").select("description").eq("cv_version_id", versionId).eq("job_title", "Senior Platform Engineer").single()).data?.description, { timeout: 30_000 })
      .toBe("Mocked E2E response text.");
    await expect(previewDoc(page)).toContainText("Mocked E2E response text.");
    await page.reload();
    await expect(previewDoc(page)).toContainText("Mocked E2E response text.");
    await dismissCookieBanner(page);
  });
});
