import { expect, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser } from "../support/test-user";
import { markOnboarded, setPlan } from "../support/roles";
import { seedCv } from "../support/cv";
import { dismissCookieBanner, makeCvTest, providersMocked, DESKTOP } from "../support/cv-fixture";

// Text Interview Coach (/dashboard/interview): role/company/JD/CV setup, interview type + difficulty, a real
// turn-by-turn AI conversation (5-8 contextual questions with follow-ups), STAR + competency scoring per answer,
// full transcript, overall score, competency radar + strengths/weaknesses, re-practice, and usage limits. Voice mode
// is out of scope (a separate, already-tracked BLOCKED row — needs ElevenLabs/OpenAI keys this environment doesn't
// have). Requires the mocked AI provider (E2E_MOCK_PROVIDERS=1).
//
// The mock's generic structured-response fixture would pick the interview chat turn's `action` enum's first member
// ("follow_up") for every single turn, stalling every mocked interview on question 1 forever short of the server's
// own 2-follow-up defence eventually forcing it on — 3x the round trips for no test value. e2e/support/mock-
// providers/mock-agent.mjs special-cases this one schema instead: it reads the same canConclude/mustAdvance signals
// the real system prompt gives the model, concludes as soon as that's allowed, and otherwise alternates one real
// follow-up then an advance — a full mocked session reaches a genuine 5-question completion (5 is the low end of
// the real 5-8 target) in exactly 9 candidate replies, cycling 5 distinct competencies so the results page's radar
// chart renders as a real radar (it falls back to a plain list under 3 distinct competencies) instead of always
// landing on the schema's first enum member.

const test = makeCvTest({ name: "Interview Coach Tester", plan: "elite" });
const db = () => getAdminClient();

const JOB_DESCRIPTION =
  "We are hiring a Senior Platform Engineer with strong TypeScript, GraphQL and Kubernetes operator experience. " +
  "You will mentor engineers, own reliability, and build internal tooling for a growing UK company.";

const GENERIC_ANSWER =
  "At my last company, our deployment pipeline was slow and unreliable, which was blocking the whole team. " +
  "I was responsible for fixing it. I rebuilt the pipeline using containerised build stages and automated rollback, " +
  "working with two other engineers over three weeks. As a result, deploy time dropped from 45 minutes to 8, and " +
  "we had zero failed rollbacks in the following quarter.";

async function setupInterview(
  page: Page,
  options: { cvTitle?: string; company: string; role: string; jobDescription?: string; difficulty?: "Easy" | "Medium" | "Hard" },
) {
  await page.goto("/dashboard/interview/new");
  await dismissCookieBanner(page);

  if (options.cvTitle) {
    await page.getByRole("combobox", { name: "CV" }).click();
    await page.getByRole("option", { name: options.cvTitle, exact: true }).click();
  }
  await page.getByLabel("Company").fill(options.company);
  await page.getByLabel("Role").fill(options.role);
  if (options.jobDescription) await page.getByLabel("Job description (optional)").fill(options.jobDescription);
  if (options.difficulty) {
    await page.getByRole("combobox", { name: "Difficulty" }).click();
    await page.getByRole("option", { name: options.difficulty, exact: true }).click();
  }

  await page.getByRole("button", { name: "Start interview" }).click();
  await page.waitForURL(/\/dashboard\/interview\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await dismissCookieBanner(page);
  const sessionId = page.url().split("/").pop()!;
  return { page, sessionId };
}

async function beginInterview(page: Page) {
  await page.getByRole("button", { name: "Begin interview" }).click();
  await expect(page.getByRole("button", { name: /Starting/ })).toHaveCount(0, { timeout: 20_000 });
}

function rateLimitedAlert(page: Page) {
  return page.getByRole("alert").filter({ hasText: /too quickly/i });
}

// The real gateway allows 10 AI requests per user per 60s (src/lib/ai/config.ts). A full session is ~16 AI calls, and
// automated answers arrive far faster than a person types, so a rate-limited turn is a normal, expected outcome here —
// not a failure. The reply stays in the textarea and, since a failed turn now persists nothing, retrying is safe.
async function submitAnswer(page: Page, text = GENERIC_ANSWER) {
  await page.getByLabel("Your answer").fill(text);
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("button", { name: /Thinking/ })).toHaveCount(0, { timeout: 60_000 });
    if (!(await rateLimitedAlert(page).isVisible().catch(() => false))) return;
    await page.waitForTimeout(15_000);
  }
  throw new Error("Still rate limited after 8 retries.");
}

/** Answers until the session concludes (the "View full results" link appears) or a safety cap is hit — a real bug that stopped the conversation converging would otherwise hang the test for the full default timeout with no clue why. */
async function runFullSession(page: Page) {
  // Begin is itself an AI call, and a previous test on the same account may have just spent the window.
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.getByRole("button", { name: "Begin interview" }).click();
    await expect(page.getByRole("button", { name: /Starting/ })).toHaveCount(0, { timeout: 60_000 });
    if (!(await rateLimitedAlert(page).isVisible().catch(() => false))) break;
    await page.waitForTimeout(15_000);
  }
  for (let i = 0; i < 15; i++) {
    if (await page.getByRole("link", { name: "View full results" }).isVisible().catch(() => false)) return;
    await submitAnswer(page);
  }
  throw new Error("Interview never concluded within 15 answers — the mock's action-picking logic likely regressed.");
}

const sessionOf = async (sessionId: string) => (await db().from("interview_sessions").select("*").eq("id", sessionId).single()).data!;
const questionsOf = async (sessionId: string) =>
  (await db().from("interview_questions").select("id, competency, display_order").eq("session_id", sessionId).order("display_order")).data ?? [];
async function scoredAnswerCount(sessionId: string): Promise<number> {
  const questions = await questionsOf(sessionId);
  if (questions.length === 0) return 0;
  const { data: answers } = await db()
    .from("interview_answers")
    .select("id")
    .in("question_id", questions.map((q) => q.id));
  if (!answers || answers.length === 0) return 0;
  const { count } = await db()
    .from("interview_scores")
    .select("id", { count: "exact", head: true })
    .in("answer_id", answers.map((a) => a.id));
  return count ?? 0;
}

test.describe("setup: role, company, JD, CV, interview type and difficulty", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("every setup field is real, persisted and grounds the session — including the CV actually chosen", async ({ open, account }) => {
    await seedCv(account.user.id, { title: "First CV", fullName: "Ada Persist" });
    const second = await seedCv(account.user.id, { title: "Second CV", fullName: "Zara Sample" });

    const page = await open();
    const { sessionId } = await setupInterview(page, {
      cvTitle: "Second CV",
      company: "Globex Corp",
      role: "Staff Engineer",
      jobDescription: JOB_DESCRIPTION,
      difficulty: "Hard",
    });

    await expect(page.getByRole("heading", { name: "Staff Engineer at Globex Corp" })).toBeVisible();
    await expect(page.getByText("Chat (text)")).toBeVisible();
    await expect(page.getByText("Hard")).toBeVisible();

    const session = await sessionOf(sessionId);
    expect(session.company).toBe("Globex Corp");
    expect(session.role).toBe("Staff Engineer");
    expect(session.job_description).toBe(JOB_DESCRIPTION);
    expect(session.mode).toBe("chat");
    expect(session.difficulty).toBe("hard");
    expect(session.status).toBe("in_progress");
    // The CV actually chosen grounds the session, not just whichever was seeded first.
    expect(session.cv_version_id).toBe(second.versionId);
    expect(session.cv_text_snapshot).toContain("Zara Sample");
    expect(session.cv_text_snapshot).not.toContain("Ada Persist");
  });
});

test.describe("setup form readability", () => {
  test("the CV, interview type and difficulty selects show readable labels, not raw ids or enum values", async ({ open, account }) => {
    await seedCv(account.user.id, { title: "Readable CV" });
    const page = await open();
    await page.goto("/dashboard/interview/new");
    await dismissCookieBanner(page);
    // Base UI's Select.Value renders the raw value (a CV's UUID, "chat", "medium") unless Select.Root is given an
    // `items` map — this form previously showed exactly that on first paint.
    await expect(page.getByRole("combobox", { name: "CV" })).toHaveText(/^Readable CV/);
    await expect(page.getByRole("combobox", { name: "Interview type" })).toHaveText(/^Chat \(text\)/);
    await expect(page.getByRole("combobox", { name: "Difficulty" })).toHaveText(/^Medium/);
  });
});

test.describe("the live conversation: 5-8 contextual questions, follow-ups, STAR scoring, transcript", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("a real question-by-question conversation with follow-ups, per-answer STAR feedback, and a completed, fully-scored session", async ({ open, account }) => {
    // A full session is ~9-10 sequential AI-gated turns, each a handful of real round trips to the (remote, shared)
    // Supabase project even with the AI call itself mocked — comfortably past Playwright's default 60s test budget.
    test.setTimeout(300_000);
    await seedCv(account.user.id);
    const page = await open();
    const { sessionId } = await setupInterview(page, { company: "Initech", role: "Backend Engineer" });

    await runFullSession(page); // begins the interview and answers until it concludes

    await expect(page.getByText("That's the end of this mock interview")).toBeVisible();
    await expect(page.getByRole("link", { name: "View full results" })).toBeVisible();
    // Inline feedback appeared live, right after the conversation moved past a question — not only after the fact
    // on the results page.
    await expect(page.getByText("Feedback on that answer").first()).toBeVisible();
    await expect(page.getByText("Situation").first()).toBeVisible();
    await expect(page.getByText("Task").first()).toBeVisible();
    await expect(page.getByText("Action").first()).toBeVisible();
    await expect(page.getByText("Result").first()).toBeVisible();

    const questions = await questionsOf(sessionId);
    expect(questions.length).toBeGreaterThanOrEqual(5); // the real 5-8 target, not a fixed count
    expect(questions.length).toBeLessThanOrEqual(8);
    // More than one distinct competency was actually probed, not the same one asked 5 times over.
    expect(new Set(questions.map((q) => q.competency)).size).toBeGreaterThan(1);

    await expect.poll(() => scoredAnswerCount(sessionId), { timeout: 15_000 }).toBe(questions.length);

    // The persisted transcript is a clean alternation: the interviewer always speaks between two candidate replies.
    // A rate-limited turn used to leave its reply saved before failing, so the retry produced two candidate turns in
    // a row (and a doubled answer) — the reply is now only saved once the interviewer's next move has succeeded, so
    // this holds even though this test deliberately triggers the real rate limiter.
    const { data: turns } = await db().from("interview_transcripts").select("speaker").eq("session_id", sessionId).order("sequence_index");
    for (let i = 1; i < turns!.length; i++) {
      expect(turns![i].speaker === "candidate" && turns![i - 1].speaker === "candidate", `duplicate candidate turn at ${i}`).toBe(false);
    }

    const session = await sessionOf(sessionId);
    expect(session.status).toBe("completed");
    expect(session.overall_score).toBeGreaterThanOrEqual(0);
    expect(session.overall_score).toBeLessThanOrEqual(100);
    expect(session.strengths.length).toBeGreaterThan(0);
    expect(session.weaknesses.length).toBeGreaterThan(0);
    expect(session.recommended_practice.length).toBeGreaterThan(0);
    expect(session.duration_seconds).toBeGreaterThanOrEqual(0);
  });
});

test.describe("results: overall score, radar, strengths/weaknesses, transcript, and re-practice", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("the results page shows a real overall score, a real radar chart, strengths/weaknesses, per-answer scores and the full transcript", async ({ open, account }) => {
    test.setTimeout(300_000);
    await seedCv(account.user.id);
    const page = await open();
    await setupInterview(page, { company: "Umbrella Corp", role: "DevOps Engineer" });
    await runFullSession(page);

    await page.getByRole("link", { name: "View full results" }).click();
    await expect(page.getByText("/ 100 overall")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Strengths" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Weaknesses" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommended practice" })).toBeVisible();

    // A real radar SVG, not the <3-competency plain-list fallback (see this file's own top-of-file doc comment for
    // why the mock is rigged to guarantee this).
    await expect(page.getByRole("heading", { name: "Competency breakdown" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Competency scores" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Per-answer scores" })).toBeVisible();
    await expect(page.getByText("Feedback on that answer").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Full transcript" })).toBeVisible();
    await expect(page.getByText("deployment pipeline was slow").first()).toBeVisible();
  });

  test("Practice weak areas starts a real, separately-persisted re-practice session targeting the earlier session's weak competencies", async ({ open, account }) => {
    test.setTimeout(300_000);
    await seedCv(account.user.id);
    const page = await open();
    const { sessionId: originalSessionId } = await setupInterview(page, { company: "Wayne Enterprises", role: "SRE" });
    await runFullSession(page);

    await page.getByRole("link", { name: "View full results" }).click();
    const practiceButton = page.getByRole("link", { name: "Practice weak areas" });
    await expect(practiceButton).toBeVisible(); // every mocked answer scores 50 — below the 70 weak-competency threshold
    await practiceButton.click();

    await expect(page.getByRole("heading", { name: "Practice weak areas" })).toBeVisible();
    await expect(page.getByLabel("Company")).toHaveValue("Wayne Enterprises");
    await expect(page.getByLabel("Role")).toHaveValue("SRE");
    await expect(page.getByText(/Focusing on:/)).toBeVisible();

    await page.getByRole("button", { name: "Start interview" }).click();
    await page.waitForURL(/\/dashboard\/interview\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const newSessionId = page.url().split("/").pop()!;
    expect(newSessionId).not.toBe(originalSessionId);

    const newSession = await sessionOf(newSessionId);
    expect(newSession.practiced_from_session_id).toBe(originalSessionId);
    expect(newSession.focus_competencies.length).toBeGreaterThan(0);
    // The earlier session is read-only input to this flow — never touched.
    const original = await sessionOf(originalSessionId);
    expect(original.status).toBe("completed");
  });
});

test.describe("usage limits", () => {
  test.skip(!providersMocked, "needs the mocked AI provider (E2E_MOCK_PROVIDERS=1)");

  test("a 3rd chat interview in the same month is blocked with the real quota message, once the plan's 2 are used", async ({ browser }) => {
    test.setTimeout(240_000);
    const user = await createIsolatedUser({ fullName: "Interview Quota Tester" });
    try {
      await markOnboarded(user.id);
      await setPlan(user.id, "pro"); // pro's chat_interviews_per_month is 2 (0016_plan_entitlement_limits.sql)
      const cv = await seedCv(user.id);

      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", viewport: DESKTOP });
      const page = await context.newPage();
      await page.goto("/login");
      await page.getByLabel("Email").fill(user.email);
      await page.getByLabel("Password", { exact: true }).fill(user.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL(/\/dashboard$/);

      // The credit is spent at Begin, not at setup (createInterviewSession's own doc comment) — so 2 real, separate
      // sessions each need only a setup + Begin, not a full 5-question completion, to exhaust the plan's allowance.
      const { sessionId: first } = await setupInterview(page, { company: "Quota Co", role: "Engineer" });
      await beginInterview(page);
      expect((await questionsOf(first)).length).toBe(1);

      await setupInterview(page, { company: "Quota Co", role: "Engineer" });
      await beginInterview(page);

      // The UI stops a 3rd session at the door: the plan's remaining count is shown, and Start interview is disabled.
      await page.goto("/dashboard/interview/new");
      await expect(page.getByText("Chat (text): 0 of 2 left this month")).toBeVisible();
      await expect(page.getByRole("button", { name: "Start interview" })).toBeDisabled();

      // ...and the server enforces it too, independent of the UI (project rule: hiding a control is never the only
      // gate). A session row can still be created out of band — setup never checks quota, only Begin does — and
      // Begin must then refuse with the real quota message and ask nothing.
      const { data: sessionRow } = await db()
        .from("interview_sessions")
        .insert({ user_id: user.id, role: "Engineer", company: "Quota Co", mode: "chat", difficulty: "medium", cv_version_id: cv.versionId, cv_text_snapshot: "Ada Persist, Senior Platform Engineer" })
        .select("id")
        .single();
      await page.goto(`/dashboard/interview/${sessionRow!.id}`);
      await page.getByRole("button", { name: "Begin interview" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /allowance|plan|included/i })).toBeVisible({ timeout: 30_000 });
      expect((await questionsOf(sessionRow!.id)).length).toBe(0);

      await context.close();
    } finally {
      await deleteIsolatedUser(user.id);
    }
  });
});
