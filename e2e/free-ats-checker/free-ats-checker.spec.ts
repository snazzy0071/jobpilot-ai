import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";

// The Free ATS Checker (/free-ats-checker) — the anonymous, no-account scan. Requires the mocked AI/email provider
// (E2E_MOCK_PROVIDERS=1); the scan mock returns fixed matched/missing keywords regardless of what's scanned:
// TypeScript matched, GraphQL/"Kubernetes operators"/mentoring missing (see e2e/support/mock-providers).

test.skip(process.env.E2E_MOCK_PROVIDERS !== "1", "needs the mocked AI/email provider (E2E_MOCK_PROVIDERS=1)");

const db = () => getAdminClient();
const SHOTS = path.join("test-results", "free-ats-checker");

// Deliberately NOT e2e/support/test-user.ts's uniqueEmail() — that helper always uses the same "e2e+<suffix>@..."
// local part, and Quick Scan's own rate-limit key (src/lib/quick-scan/normalize-email.ts) strips everything after
// "+" for every domain, exactly to stop someone re-rolling their free-scan quota with a plus-tag. Reusing
// uniqueEmail() here would make every "distinct" test share one real 2-scans/month bucket. Each call below gets a
// genuinely different local part instead, so unrelated tests don't fight over the same quota.
let emailCounter = 0;
function freshEmail(): string {
  emailCounter += 1;
  return `e2e-fats-${Date.now()}-${emailCounter}-${Math.random().toString(36).slice(2, 8)}@e2e.jobpilotai.test`;
}

const JOB_DESCRIPTION =
  "We are hiring a Senior Platform Engineer with strong TypeScript, GraphQL and Kubernetes operator experience. " +
  "You will mentor engineers, own reliability, and build internal tooling for a growing UK company.";

async function dismissCookieBanner(page: Page) {
  await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 3000 }).catch(() => undefined);
}

async function submitScan(page: Page, options: { email: string; filePath: string; jobDescription?: string }) {
  await page.goto("/free-ats-checker");
  await dismissCookieBanner(page);
  await page.getByLabel("Your CV").setInputFiles(options.filePath);
  if (options.jobDescription) await page.getByLabel("Job description (optional)").fill(options.jobDescription);
  await page.getByLabel("Email", { exact: true }).fill(options.email);
  await page.getByRole("button", { name: "Score my CV" }).click();
}

// Not a check for "\d+/100" anywhere on the page — the marketing hero further down /free-ats-checker has its own
// illustrative "78/100" mockup (AtsScorePreview) that's always rendered, scan or no scan, so that regex is satisfied
// the instant the page loads and proves nothing about whether the real scan finished. "Reopen this result later"
// only ever appears once a genuine result has come back from the (mocked) AI call.
async function waitForResult(page: Page) {
  await expect(page.getByRole("link", { name: "Reopen this result later" })).toBeVisible({ timeout: 20_000 });
}

test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

// This whole spec runs every real scan from one machine's IP within a single, fast automated run — a concentration
// real usage never produces, but that the secondary IP-scoped abuse guard (MAX_SCANS_PER_IP_PER_DAY, src/lib/quick-
// scan/rate-limit.ts) exists precisely to catch. Left alone, this file's own ~15 real scans would trip that 10/day
// cap partway through and fail later tests over test concentration, not a real bug. Clearing only the IP scope (not
// quick_scan_email, which test4 exercises directly) before each test keeps that guard out of every other test's way
// without touching the actual behavior under test anywhere.
test.beforeEach(async () => {
  await db().from("anonymous_rate_limits").delete().eq("scope", "quick_scan_ip");
});

test.describe("no account required, immediate results", () => {
  test("a PDF upload with a job description scores immediately: matched/missing keywords, 3 priority fixes, a private result link", async ({ page }) => {
    const pdfPath = path.join(SHOTS, "cv.pdf");
    execFileSync(process.execPath, ["e2e/support/make-test-pdf.mjs", pdfPath, "Ada Persist Senior Platform Engineer TypeScript Kubernetes cloud infrastructure reliable platforms"]);

    await submitScan(page, { email: freshEmail(), filePath: pdfPath, jobDescription: JOB_DESCRIPTION });

    // Immediate: no navigation away, no account created — the result renders on the same page.
    await waitForResult(page);
    await expect(page.getByText(/match with this job description/)).toBeVisible();
    await expect(page.getByText("TypeScript", { exact: true })).toBeVisible();
    await expect(page.getByText("Top fixes")).toBeVisible();
    const fixCount = await page.getByText("Top fixes").locator("xpath=following-sibling::ul[1]/li").count();
    expect(fixCount).toBeLessThanOrEqual(3);
    expect(fixCount).toBeGreaterThan(0);

    await expect(page.getByRole("link", { name: "Reopen this result later" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Download PDF/ })).toBeVisible();
  });

  test("a DOCX upload and a plain-text upload both work", async ({ page }) => {
    const docxPath = path.join(SHOTS, "cv.docx");
    execFileSync(process.execPath, ["e2e/support/make-test-docx.mjs", docxPath, "Ada Persist Senior Platform Engineer TypeScript Kubernetes cloud infrastructure reliable platforms"]);
    await submitScan(page, { email: freshEmail(), filePath: docxPath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page);

    const txtPath = path.join(SHOTS, "cv.txt");
    fs.writeFileSync(txtPath, "Ada Persist Senior Platform Engineer TypeScript Kubernetes cloud infrastructure reliable platforms building for eight years.");
    await submitScan(page, { email: freshEmail(), filePath: txtPath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page);
  });

  test("the job description is optional: leaving it blank still scores, framed as a general check rather than a job match", async ({ page }) => {
    const pdfPath = path.join(SHOTS, "cv.pdf"); // reuse the file from the first test
    await submitScan(page, { email: freshEmail(), filePath: pdfPath }); // no jobDescription
    await waitForResult(page);
    await expect(page.getByText(/general ATS-readiness/)).toBeVisible();
    await expect(page.getByText(/match with this job description/)).toHaveCount(0);
  });
});

test.describe("abuse protection", () => {
  test("2 scans per email per month: a third attempt in the same month is blocked, with nothing new persisted", async ({ page }) => {
    const email = freshEmail();
    const pdfPath = path.join(SHOTS, "cv.pdf");

    await submitScan(page, { email, filePath: pdfPath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page);

    await submitScan(page, { email, filePath: pdfPath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page);

    // Scoped to a narrow time window right around the blocked attempt, rather than a whole-table before/after count
    // — this table is the shared dev/prod Supabase project (not a per-run-isolated test database), so a table-wide
    // count can pick up unrelated rows from other traffic and flake independently of anything this test did.
    const beforeThirdAttempt = new Date().toISOString();

    await submitScan(page, { email, filePath: pdfPath, jobDescription: JOB_DESCRIPTION });
    await expect(page.getByRole("alert").filter({ hasText: /used your 2 free scans/i })).toBeVisible({ timeout: 20_000 });
    // Not a check for "/100" anywhere on the page — the marketing hero further down has its own illustrative
    // "78/100" mockup (AtsScorePreview) that's always rendered, scan or no scan. "Reopen this result later" only
    // ever appears on a genuine, freshly-scored result.
    await expect(page.getByRole("link", { name: "Reopen this result later" })).toHaveCount(0); // no third result rendered
    const newRowsSinceThirdAttempt = (
      await db().from("quick_scan_results").select("id", { count: "exact", head: true }).gte("created_at", beforeThirdAttempt)
    ).count;
    expect(newRowsSinceThirdAttempt).toBe(0); // blocked before the AI call, so nothing new was persisted
  });

  test("the honeypot field silently rejects a bot-shaped submission, and nothing is scanned or charged against the quota", async ({ page }) => {
    const email = freshEmail();
    const pdfPath = path.join(SHOTS, "cv.pdf");
    await page.goto("/free-ats-checker");
    await dismissCookieBanner(page);
    await page.getByLabel("Your CV").setInputFiles(pdfPath);
    await page.getByLabel("Job description (optional)").fill(JOB_DESCRIPTION);
    await page.getByLabel("Email", { exact: true }).fill(email);
    // A real user never sees or fills this — Playwright can still target it directly by id, the way a bot's
    // autofill would.
    await page.locator("#website").fill("http://spam.example");
    await page.getByRole("button", { name: "Score my CV" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Couldn't run that scan/i })).toBeVisible({ timeout: 10_000 });
    // Same reasoning as the quota test above: the marketing hero's illustrative score mockup is always on the page,
    // so absence of a result is checked via the result-only "Reopen this result later" link instead.
    await expect(page.getByRole("link", { name: "Reopen this result later" })).toHaveCount(0);

    // The quota is untouched — a real scan for the same email right after still succeeds (would be blocked as the
    // "2nd of 2" if the honeypot attempt had actually consumed one).
    await submitScan(page, { email, filePath: pdfPath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page);
    await submitScan(page, { email, filePath: pdfPath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page); // 2nd of 2 still allowed
  });
});

test.describe("the saved result: token, PDF report, email, and what's actually stored", () => {
  test("a private, unguessable link reopens the exact same result; a wrong token 404s; the PDF downloads with real content", async ({ page, request }) => {
    const pdfPath = path.join(SHOTS, "cv.pdf");
    await submitScan(page, { email: freshEmail(), filePath: pdfPath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page);

    const reopenLink = page.getByRole("link", { name: "Reopen this result later" });
    const href = await reopenLink.getAttribute("href");
    expect(href).toMatch(/^\/free-ats-checker\/results\/.{20,}/);
    const token = href!.split("/").pop()!;

    await page.goto(href!);
    await expect(page.getByText(/\d{1,3}\s*\/\s*100/).first()).toBeVisible();
    await expect(page.getByText("TypeScript", { exact: true })).toBeVisible();

    // Not just any string — an actual wrong token gets the same "not found" a made-up one would.
    const wrongToken = token.slice(0, -4) + (token.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    const notFoundResponse = await page.goto(`/free-ats-checker/results/${wrongToken}`);
    expect(notFoundResponse?.status()).toBe(404);

    const pdfResponse = await request.get(`/api/quick-scan/${token}/pdf`);
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
    const pdfBuffer = Buffer.from(await pdfResponse.body());
    const pdfPathOut = path.join(SHOTS, "report.pdf");
    fs.writeFileSync(pdfPathOut, pdfBuffer);
    const parsed = JSON.parse(execFileSync(process.execPath, [path.join(process.cwd(), "e2e/support/pdf-text.mjs"), pdfPathOut], { encoding: "utf8" }));
    expect(parsed.text).toContain("ATS Scan Report");
    expect(parsed.text).toMatch(/\d{1,3}/);
    expect(parsed.text).toContain("TypeScript");

    const wrongPdfResponse = await request.get(`/api/quick-scan/${wrongToken}/pdf`);
    expect(wrongPdfResponse.status()).toBe(404);
  });

  test("the report email is sent (mocked Resend) once a result exists", async ({ page }) => {
    const pdfPath = path.join(SHOTS, "cv.pdf");
    await submitScan(page, { email: freshEmail(), filePath: pdfPath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page);
    // The UI only ever claims this when the send genuinely succeeded (runQuickScan's own emailSent flag) — this
    // wording only appears on that success path, not just because sending was attempted.
    await expect(page.getByText(/We've also emailed you this report as a PDF/)).toBeVisible();
  });

  test("temporary upload cleanup: neither the CV text nor the job description is ever persisted, only the reduced result", async ({ page }) => {
    const distinctiveCvText = `Ada Persist DistinctiveMarker${Date.now()}`;
    const filePath = path.join(SHOTS, "distinctive.txt");
    fs.writeFileSync(filePath, `${distinctiveCvText} Senior Platform Engineer with TypeScript experience.`);
    await submitScan(page, { email: freshEmail(), filePath, jobDescription: JOB_DESCRIPTION });
    await waitForResult(page);

    const href = await page.getByRole("link", { name: "Reopen this result later" }).getAttribute("href");
    const token = href!.split("/").pop()!;
    // Inlined rather than importing src/lib/quick-scan/result-token.ts's hashResultToken directly — that module is
    // marked "server-only" (a Next.js Server Component guard that unconditionally throws outside a Next server
    // build), and this spec runs as plain Node via Playwright. The hash is a one-line sha256, identical to what
    // hashResultToken does.
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: row } = await db().from("quick_scan_results").select("*").eq("token_hash", tokenHash).single();

    expect(row).toBeTruthy();
    // The row's own columns are the complete, real shape of what's stored — no cv_text/job_description column exists
    // at all (see supabase/migrations/0036_quick_scan_results.sql), and neither the uploaded file's distinctive
    // marker nor the pasted job description text appears anywhere in the row, confirming nothing beyond the
    // already-reduced result (score/summary/keywords/fixes) was kept.
    expect(Object.keys(row!).sort()).toEqual(
      ["id", "token_hash", "overall_score", "summary", "matched_keywords", "missing_keywords", "top_fixes", "has_job_description", "created_at", "expires_at"].sort(),
    );
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain(distinctiveCvText);
    expect(serialized).not.toContain("Senior Platform Engineer with TypeScript experience");
    expect(serialized).not.toContain(JOB_DESCRIPTION);
    expect(row!.has_job_description).toBe(true);
  });
});
