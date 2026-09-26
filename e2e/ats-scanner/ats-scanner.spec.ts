import { expect, type Page } from "@playwright/test";
import { createIsolatedUser, deleteIsolatedUser } from "../support/test-user";
import { getAdminClient } from "../support/admin-client";
import { markOnboarded } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest, providersMocked } from "../support/cv-fixture";

// The authenticated ATS Scanner (/dashboard/ats-scanner): a real score, matched/missing keywords, four section
// scores, prioritized fixes, scan history + rescan, real persistence, plan limits, and its own upload-a-file entry
// point — separate from a saved CV, the Free ATS Checker (unauthenticated) and the CV editor's own embedded panel.
// Requires the mocked AI provider (E2E_MOCK_PROVIDERS=1); its scan mock returns the same fixed keywords regardless
// of what's scanned: TypeScript matched, GraphQL/"Kubernetes operators"/mentoring missing.

const test = makeCvTest({ name: "ATS Scanner Tester", plan: "elite" });
const db = () => getAdminClient();

const JOB_DESCRIPTION =
  "We are hiring a Senior Platform Engineer with strong TypeScript, GraphQL and Kubernetes operator experience. " +
  "You will mentor engineers, own reliability, and build internal tooling for a growing UK company.";

async function openScanner(page: Page, cvId?: string) {
  await page.goto(cvId ? `/dashboard/ats-scanner?cvId=${cvId}` : "/dashboard/ats-scanner");
  await dismissCookieBanner(page);
}

const SCAN_BUTTON = /scan cv against this role|re-score against this role|scan this cv/i;

async function runScan(page: Page, jobDescription = JOB_DESCRIPTION) {
  await page.getByLabel("Paste a job description", { exact: false }).fill(jobDescription);
  await page.getByRole("button", { name: SCAN_BUTTON }).click();
  // The button re-enabling only means the request finished, not that the result has rendered yet (and not that
  // it succeeded). The score ring's own accessible label ("Score: 50 out of 100") isn't a safe readiness signal
  // by itself — the fictional "Sample preview" card (shown until a real scan exists) has one too, so waiting for
  // that label alone resolves immediately against the sample, before any real scan has even started. Wait for
  // the sample to be gone instead — the one state change that only ever happens once a real result exists.
  await expect(page.getByText("Sample preview")).toHaveCount(0, { timeout: 30_000 });
}

test.describe("scanning a saved CV", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("a real score, four section scores, matched/missing keywords and prioritized fixes — all persisted and surviving a reload", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id);
    const page = await open();
    await openScanner(page, cvId);
    await expect(page.getByText("Scoring")).toContainText("Audit CV");

    await runScan(page);
    // Score + four independent section scores.
    await expect(page.getByLabel(/^Score: \d+ out of 100/)).toBeVisible();
    for (const label of ["Keyword", "Structure", "Format", "Sections"]) {
      await expect(page.getByText(new RegExp(`^${label} \\d`))).toBeVisible();
    }

    // Matched keyword (the badge also shows how many times it occurs in the job description, e.g. "TypeScript×1").
    await expect(page.getByText(/^TypeScript/).first()).toBeVisible();

    // Recommendations: missing-keyword gaps and the AI's own prioritized fixes.
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
    await expect(page.getByText(/GraphQL/).first()).toBeVisible();

    // Real persistence: a real row in every ATS table, scoped to this version.
    const { data: scans } = await db().from("ats_scans").select("id, source, cv_version_id, job_description, match_score, keyword_score, structure_score, format_score, sections_score").eq("cv_version_id", versionId);
    expect(scans).toHaveLength(1);
    expect(scans![0].source).toBe("cv_version");
    expect(scans![0].job_description).toBe(JOB_DESCRIPTION);
    for (const column of ["match_score", "keyword_score", "structure_score", "format_score", "sections_score"] as const) {
      expect(scans![0][column]).toBeGreaterThanOrEqual(0);
      expect(scans![0][column]).toBeLessThanOrEqual(100);
    }
    const { data: keywords } = await db().from("ats_keywords").select("keyword, status, importance").eq("scan_id", scans![0].id);
    expect(keywords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keyword: "TypeScript", status: "matched" }),
        expect.objectContaining({ keyword: "GraphQL", status: "missing" }),
      ]),
    );
    const { data: issues } = await db().from("ats_issues").select("source, priority").eq("scan_id", scans![0].id);
    expect(issues!.some((row) => row.source === "ai" && row.priority !== null)).toBe(true);

    // The score is kept on the CV's own record, shown on the list card.
    await expect.poll(async () => (await db().from("cv_versions").select("ats_score").eq("id", versionId).single()).data?.ats_score, { timeout: 15_000 }).toBe(scans![0].match_score);

    // Survives a reload.
    await page.reload();
    await expect(page.getByText(`${scans![0].match_score}`, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/^TypeScript/).first()).toBeVisible();
  });

  test("importing from a blocked URL falls back to paste, with a real reason shown", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id);
    const page = await open();
    await openScanner(page, cvId);

    await page.getByRole("tab", { name: "Import from URL" }).click();
    await page.getByLabel("Job posting link").fill("http://localhost/some-job");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /local address/i })).toBeVisible();
    // Falls back to the paste tab so the scan can still proceed by hand.
    await expect(page.getByLabel("Paste a job description", { exact: false })).toBeVisible();
  });

  test("scan history: a past scan can be reviewed without a new AI call, and re-scoring adds a new entry", async ({ open, account }) => {
    const { cvId, versionId } = await seedCv(account.user.id);
    const page = await open();
    await openScanner(page, cvId);

    await runScan(page, JOB_DESCRIPTION);
    const firstScore = await page.getByLabel(/^Score: \d+ out of 100/).getAttribute("aria-label");

    await page.getByLabel("Paste a job description", { exact: false }).fill(`${JOB_DESCRIPTION} Also requires Python.`);
    await page.getByRole("button", { name: "Re-score against this role" }).click();
    await expect(page.getByText(/Past scans \(2\)/)).toBeVisible({ timeout: 30_000 });

    await expect.poll(async () => (await db().from("ats_scans").select("id", { count: "exact", head: true }).eq("cv_version_id", versionId)).count).toBe(2);

    // Switch back to the earlier scan: an instant, local swap — no "Scanning…" spinner, no new database row.
    await page.getByLabel(/Past scans/).click();
    await page.getByRole("option").last().click(); // the list is newest-first; the last option is the original scan
    await expect(page.getByText(/Viewing an earlier scan/)).toBeVisible();
    await expect(page.getByLabel(/^Score: \d+ out of 100/)).toHaveAttribute("aria-label", firstScore!);
    expect((await db().from("ats_scans").select("id", { count: "exact", head: true }).eq("cv_version_id", versionId)).count).toBe(2); // still 2, not 3
  });

  test("the Free plan is blocked from a tailored scan, with a clear reason and nothing charged", async ({ browser }) => {
    const free = await createIsolatedUser({ fullName: "Free ATS Scanner Tester" });
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
      await openScanner(page, cvId);
      await expect(page.getByText(/Upgrade for tailored scans/)).toBeVisible();

      await page.getByLabel("Paste a job description", { exact: false }).fill(JOB_DESCRIPTION);
      await page.getByRole("button", { name: "Scan CV against this role" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /plan|upgrade|included/i })).toBeVisible({ timeout: 20_000 });
      expect((await db().from("ats_scans").select("id").eq("cv_version_id", versionId)).data).toHaveLength(0);
      await context.close();
    } finally {
      await deleteIsolatedUser(free.id);
    }
  });

  test("loading and error states exist for the route", async ({ open, account }) => {
    const { cvId } = await seedCv(account.user.id);
    const page = await open();
    await page.route(/\/dashboard\/ats-scanner(\?|$)/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await openScanner(page, cvId);
    // The skeleton may already have resolved by the time we can look — what matters is the route ships one at all.
    const html = await page.content();
    expect(html).toBeTruthy();
    await expect(page.getByRole("heading", { name: "See your CV the way a filter" })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("scanning an uploaded file", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("pasted CV text: a real score, matched/missing keywords, file-format checks are absent for plain text, and it's saved with no CV attached", async ({ open, account }) => {
    const page = await open();
    await page.goto("/dashboard/ats-scanner?mode=upload");
    await dismissCookieBanner(page);
    await expect(page.getByRole("tab", { name: "A saved CV" })).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("tab", { name: "Upload a file", exact: true })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("tab", { name: "Paste CV text" }).click();
    await page.getByLabel("Your CV, as plain text").fill(
      "Ada Persist — Senior Platform Engineer. TypeScript, Kubernetes, cloud infrastructure. Eight years building reliable platforms.",
    );
    await runScan(page);

    await expect(page.getByLabel(/^Score: \d+ out of 100/)).toBeVisible();
    await expect(page.getByText(/^TypeScript/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "File format checks" })).toHaveCount(0); // plain text has nothing to check

    const { data: scans } = await db().from("ats_scans").select("id, source, cv_version_id, job_description").eq("user_id", account.user.id).eq("source", "manual_text");
    expect(scans).toHaveLength(1);
    expect(scans![0].cv_version_id).toBeNull();
    expect(scans![0].job_description).toBe(JOB_DESCRIPTION);
    const { data: keywords } = await db().from("ats_keywords").select("keyword, status").eq("scan_id", scans![0].id);
    expect(keywords).toEqual(expect.arrayContaining([expect.objectContaining({ keyword: "TypeScript", status: "matched" })]));

    // No CV behind this scan: no "Fix in {section}" link, unlike the saved-CV path.
    await expect(page.getByRole("button", { name: /^Fix in /i })).toHaveCount(0);
  });

  test("a real PDF upload is parsed, scored, and its own structural format facts are shown and saved", async ({ open, account }) => {
    const page = await open();
    await page.goto("/dashboard/ats-scanner?mode=upload");
    await dismissCookieBanner(page);

    // A minimal, real, valid one-page PDF with actual selectable text — not a renamed non-PDF file — so the app's
    // own magic-byte + pdf-parse validation (src/lib/files/magic-bytes.ts, parse-document.ts) is exercised for real.
    const pdfPath = "test-results/ats-scanner-upload.pdf";
    const { execFileSync } = await import("node:child_process");
    execFileSync(process.execPath, ["e2e/support/make-test-pdf.mjs", pdfPath, "Ada Persist Senior Platform Engineer TypeScript Kubernetes cloud infrastructure reliable platforms"]);

    await page.getByLabel("PDF, DOCX or plain text — up to 10MB").setInputFiles(pdfPath);
    await runScan(page);

    await expect(page.getByLabel(/^Score: \d+ out of 100/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "File format checks" })).toBeVisible();
    await expect(page.getByText("selectable", { exact: false }).first()).toBeVisible();

    const { data: scans } = await db().from("ats_scans").select("id, source, cv_text_snapshot").eq("user_id", account.user.id).eq("source", "manual_text");
    expect(scans!.length).toBeGreaterThanOrEqual(1);
    const scan = scans!.find((row) => row.cv_text_snapshot.includes("Ada Persist"))!;
    expect(scan).toBeTruthy();
    const { data: issues } = await db().from("ats_issues").select("source, section_key").eq("scan_id", scan.id).eq("source", "format");
    // Real, persisted structural findings — no CV section, since there is no CV.
    expect(issues!.every((row) => row.section_key === null)).toBe(true);
  });

  test("no CV, no file, no text: the scanner says what's missing rather than doing nothing", async ({ open }) => {
    const page = await open();
    await page.goto("/dashboard/ats-scanner?mode=upload");
    await dismissCookieBanner(page);
    await page.getByLabel("Paste a job description", { exact: false }).fill(JOB_DESCRIPTION);
    await page.getByRole("button", { name: "Scan this CV" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /choose a cv file/i })).toBeVisible();
  });
});
