import { createClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { createIsolatedUser, deleteIsolatedUser, type IsolatedUser } from "../support/test-user";
import { dismissCookieBanner, makeCvTest } from "../support/cv-fixture";
import { makeSuperAdmin, markOnboarded, setPlan } from "../support/roles";

// Test Prep, end to end against the REAL database and the real question bank (19 packs, ~177 original questions). No AI
// or provider is involved, so this runs in either e2e mode. One Premium account is shared (serial: later tests build on
// the history earlier ones create); a Free account, an admin and a restricted admin are created per test and deleted after.
// Anything the admin tests create (a test type with its pack and questions) is removed by slug at the end.

const test = makeCvTest({ name: "Test Prep Tester", plan: "premium" });
test.describe.configure({ mode: "serial" });

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const db = () => getAdminClient();
const HOME = "/dashboard/test-prep";
const INTEGRITY_PACK = "integrity-and-pressure-scenarios";
const ADMIN_TYPE_SLUG = "e2e-test-prep-type";

// ---- helpers ------------------------------------------------------------------------------------------------------

type Pinned = { position: number; prompt: string; correct: string | null; options: string[]; explanation: string | null; id: string };

async function go(page: Page, url: string) {
  await page.goto(url);
  await dismissCookieBanner(page);
}

async function packId(slug: string): Promise<string> {
  const { data, error } = await db().from("question_packs").select("id").eq("slug", slug).single();
  if (error || !data) throw new Error(`no pack ${slug}: ${error?.message}`);
  return data.id;
}

async function latestSession(userId: string) {
  const { data, error } = await db().from("test_sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }).limit(1).single();
  if (error || !data) throw new Error(`no session: ${error?.message}`);
  return data;
}

/** The questions the server pinned to a session, in the order they are served, with their answer key (service role). */
async function pinned(sessionId: string): Promise<Pinned[]> {
  const { data, error } = await db()
    .from("test_session_questions")
    .select("position, questions(id, prompt, options, correct_answer, explanation)")
    .eq("test_session_id", sessionId)
    .order("position");
  if (error || !data) throw new Error(`no pinned questions: ${error?.message}`);
  return data.map((row) => {
    const q = (Array.isArray(row.questions) ? row.questions[0] : row.questions) as { id: string; prompt: string; options: string[]; correct_answer: string | null; explanation: string | null };
    return { position: row.position, prompt: q.prompt, correct: q.correct_answer, options: q.options, explanation: q.explanation, id: q.id };
  });
}

/** Picks an option. Radios are visually hidden, so click the label that wraps them; diagram options are named "Option A". */
async function choose(page: Page, option: string) {
  const radio = page.getByRole("radio", { name: option, exact: true }).or(page.getByRole("radio", { name: `Option ${option}`, exact: true }));
  await page.locator("label", { has: radio }).first().click();
}

function wrongOption(question: Pinned): string {
  return question.options.find((option) => option !== question.correct)!;
}

/** Practice mode: answer question `index` (submit, wait for feedback) — right or deliberately wrong — and stay on it. */
async function answerPractice(page: Page, question: Pinned, right: boolean) {
  await expect(page.getByTestId("question-prompt")).toHaveText(question.prompt);
  await choose(page, right ? question.correct! : wrongOption(question));
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByTestId("answer-feedback")).toBeVisible();
}

async function runPractice(page: Page, questions: Pinned[], wrongIndexes: number[] = []) {
  for (const [index, question] of questions.entries()) {
    await answerPractice(page, question, !wrongIndexes.includes(index));
    if (index < questions.length - 1) await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByTestId("session-summary")).toBeVisible();
}

async function loginContext(browser: Browser, user: IsolatedUser) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  return { context, page };
}

// ---- plan gating --------------------------------------------------------------------------------------------------

test.describe("plan gating", () => {
  test("a Free account sees an honest locked page, and the server refuses it even so", async ({ browser }) => {
    const user = await createIsolatedUser({ fullName: "Free Prep Tester" });
    await markOnboarded(user.id);
    const { context, page } = await loginContext(browser, user);
    try {
      await page.waitForURL(/\/dashboard$/);
      await dismissCookieBanner(page);
      for (const url of [HOME, `${HOME}/progress`, `${HOME}/daily`, `${HOME}/practice/${await packId(INTEGRITY_PACK)}`]) {
        await page.goto(url);
        await expect(page.getByTestId("test-prep-locked")).toBeVisible();
        await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();
        await expect(page.getByTestId("pack-link")).toHaveCount(0);
        await expect(page.getByTestId("question-prompt")).toHaveCount(0);
      }
      // The locked page states the real size of the bank, not a made-up number.
      const { count } = await db().from("questions").select("id", { count: "exact", head: true }).eq("is_active", true);
      await page.goto(HOME);
      await expect(page.getByTestId("test-prep-locked")).toContainText(`${(count ?? 0).toLocaleString("en-GB")} original practice questions`);

      // The dashboard's daily card degrades to a one-line upgrade prompt on this plan.
      await page.goto("/dashboard");
      await expect(page.getByTestId("daily-locked")).toBeVisible();
    } finally {
      await context.close();
      await deleteIsolatedUser(user.id);
    }
  });

  test("a signed-in user cannot write their own results with their own token", async ({ account }) => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signInError } = await anon.auth.signInWithPassword({ email: account.user.email, password: account.user.password });
    expect(signInError).toBeNull();

    // Reads of their own rows are allowed; every write is refused (migration 0110), so a score, a deadline or a streak
    // day can only ever come from the server's own checks.
    const { data: pack } = await db().from("question_packs").select("id").eq("slug", INTEGRITY_PACK).single();
    const forged = await anon.from("test_sessions").insert({ user_id: account.user.id, question_pack_id: pack!.id, total_questions: 1, correct_count: 1, score: 100, completed_at: new Date().toISOString() });
    expect(forged.error).not.toBeNull();

    const streak = await anon.from("daily_practice_completions").insert({ user_id: account.user.id, local_date: "2020-01-01", correct_count: 5, total_questions: 5 });
    expect(streak.error).not.toBeNull();

    const progress = await anon.from("practice_progress").insert({ user_id: account.user.id, test_type_id: (await db().from("test_types").select("id").limit(1).single()).data!.id, attempts_count: 99, best_score: 100 });
    expect(progress.error).not.toBeNull();

    const { count } = await db().from("test_sessions").select("id", { count: "exact", head: true }).eq("user_id", account.user.id);
    expect(count).toBe(0);
    const { count: streakCount } = await db().from("daily_practice_completions").select("id", { count: "exact", head: true }).eq("user_id", account.user.id);
    expect(streakCount).toBe(0);
  });
});

// ---- catalogue ----------------------------------------------------------------------------------------------------

test.describe("catalogue", () => {
  test("shows all five formats with real question counts and exam times", async ({ open }) => {
    const page = await open();
    await go(page, HOME);
    await expect(page.getByTestId("test-type")).toHaveCount(5);
    for (const name of ["Critical Thinking", "Situational Judgement", "Numerical Reasoning", "Verbal Reasoning", "Diagrammatic Reasoning"]) {
      await expect(page.getByRole("heading", { name: new RegExp(name, "i"), level: 2 })).toBeVisible();
    }

    const { data: packs } = await db().from("question_packs").select("id, name, time_limit_seconds, questions(id, is_active)").eq("is_active", true);
    await expect(page.getByTestId("pack-link")).toHaveCount(packs!.length);
    for (const pack of packs!) {
      const active = (pack.questions as { is_active: boolean }[]).filter((q) => q.is_active).length;
      expect(active).toBeGreaterThan(0);
      const link = page.getByTestId("pack-link").filter({ hasText: pack.name });
      await expect(link).toContainText(`${active} questions`);
      if (pack.time_limit_seconds) await expect(link).toContainText("exam");
    }
    // Every format has enough material to be worth practising.
    expect(packs!.reduce((sum, pack) => sum + (pack.questions as unknown[]).length, 0)).toBeGreaterThanOrEqual(150);
  });
});

// ---- practice, explanations, results, history ---------------------------------------------------------------------

test.describe("practice mode", () => {
  let reviewedSessionId = "";

  test("instant feedback with the answer and explanation; a graded answer is locked; results add up", async ({ open, account }) => {
    const page = await open();
    await go(page, `${HOME}/practice/${await packId(INTEGRITY_PACK)}`);
    await page.getByRole("button", { name: /^Practice/ }).click();
    await expect(page.getByTestId("quiz-progress")).toContainText("0 of");

    const session = await latestSession(account.user.id);
    expect(session.mode).toBe("practice");
    expect(session.expires_at).toBeNull();
    const questions = await pinned(session.id);
    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(session.total_questions).toBe(questions.length);

    // First question: answer it wrong on purpose.
    await answerPractice(page, questions[0], false);
    const feedback = page.getByTestId("answer-feedback");
    await expect(feedback).toContainText("Not quite");
    await expect(feedback).toContainText(questions[0].correct!);
    await expect(feedback).toContainText(questions[0].explanation!.slice(0, 40));
    // Locked: it can't be changed after seeing the answer.
    await expect(page.getByRole("radio").first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Submit answer" })).toHaveCount(0);

    // The rest right.
    await page.getByRole("button", { name: "Next", exact: true }).click();
    for (const [index, question] of questions.entries()) {
      if (index === 0) continue;
      await answerPractice(page, question, true);
      await expect(page.getByTestId("answer-feedback")).toContainText("Correct");
      if (index < questions.length - 1) await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await page.getByRole("button", { name: "Finish" }).click();

    const expected = Math.round(((questions.length - 1) / questions.length) * 100);
    await expect(page.getByTestId("summary-score")).toHaveText(`${expected}%`);
    await expect(page.getByTestId("summary-counts")).toContainText(`${questions.length - 1} correct out of ${questions.length}`);
    await expect(page.getByTestId("subtype-row").first()).toBeVisible();
    // The review defaults to what was missed, with the key and explanation.
    await expect(page.getByTestId("review-item")).toHaveCount(1);
    await expect(page.getByTestId("review-item")).toContainText(questions[0].correct!);

    const done = await latestSession(account.user.id);
    expect(done.completed_at).not.toBeNull();
    expect(done.correct_count).toBe(questions.length - 1);
    expect(done.score).toBe(expected);
    reviewedSessionId = done.id;

    // Answers keep their topic, difficulty and test type (so history survives edits to the question).
    const { data: answers } = await db().from("test_answers").select("subtype, difficulty, test_type_id, is_correct").eq("test_session_id", done.id);
    expect(answers).toHaveLength(questions.length);
    expect(answers!.every((a) => a.test_type_id && a.subtype && a.difficulty)).toBe(true);
    expect(answers!.filter((a) => a.is_correct === false)).toHaveLength(1);

    const { data: progress } = await db().from("practice_progress").select("attempts_count, best_score").eq("user_id", account.user.id);
    expect(progress).toHaveLength(1);
    expect(progress![0].attempts_count).toBe(1);
    expect(progress![0].best_score).toBe(expected);
  });

  test("history lists the session and reopens it with the full review", async ({ open, account }) => {
    const page = await open();
    await go(page, `${HOME}/progress`);
    await expect(page.getByTestId("session-history-row").first()).toBeVisible();
    await page.getByTestId("session-history-row").first().click();
    await expect(page).toHaveURL(new RegExp(`/history/${reviewedSessionId}`));
    await expect(page.getByTestId("session-summary")).toBeVisible();
    await page.getByRole("button", { name: /^All \(/ }).click();
    const questions = await pinned(reviewedSessionId);
    await expect(page.getByTestId("review-item")).toHaveCount(questions.length);

    // A session that isn't yours (or isn't finished) can't be reviewed.
    const other = await createIsolatedUser({ fullName: "Other Prep User" });
    try {
      const { data: foreign } = await db().from("test_sessions").select("id").eq("user_id", other.id);
      expect(foreign).toHaveLength(0);
      const unfinished = await db().from("test_sessions").insert({ user_id: account.user.id, question_pack_id: await packId(INTEGRITY_PACK), total_questions: 1, mode: "practice" }).select("id").single();
      await page.goto(`${HOME}/history/${unfinished.data!.id}`);
      await expect(page.getByTestId("session-summary")).toHaveCount(0);
      await db().from("test_sessions").delete().eq("id", unfinished.data!.id);
    } finally {
      await deleteIsolatedUser(other.id);
    }
  });
});

// ---- timed mode ---------------------------------------------------------------------------------------------------

test.describe("timed mode", () => {
  test("an exam: no answers or explanations until you finish; answers can change; skipped counts against you", async ({ open, account }) => {
    const page = await open();
    const id = await packId(INTEGRITY_PACK);
    await go(page, `${HOME}/practice/${id}`);
    await page.getByRole("button", { name: /^Timed exam/ }).click();
    await expect(page.getByTestId("quiz-timer")).toBeVisible();
    await expect(page.getByTestId("quiz-progress")).toContainText("timed exam");

    const session = await latestSession(account.user.id);
    expect(session.mode).toBe("timed");
    const { data: pack } = await db().from("question_packs").select("time_limit_seconds").eq("id", id).single();
    // The deadline is the server's: started_at + the pack's own limit.
    const span = (new Date(session.expires_at).getTime() - new Date(session.started_at).getTime()) / 1000;
    expect(Math.round(span)).toBe(pack!.time_limit_seconds);

    const questions = await pinned(session.id);
    const skipped = questions.length - 1;

    // Change an answer: first a wrong one, then the right one. Nothing about correctness is shown.
    await choose(page, wrongOption(questions[0]));
    await expect(page.getByText("Answer saved")).toBeVisible();
    await expect(page.getByTestId("answer-feedback")).toHaveCount(0);
    await choose(page, questions[0].correct!);
    await expect(page.getByText("Answer saved")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(questions[0].explanation!.slice(0, 40));
    await expect(page.getByRole("radio", { name: questions[0].correct!, exact: true })).toBeEnabled();

    for (let index = 1; index < skipped; index++) {
      await page.getByRole("navigation", { name: "Questions" }).getByRole("button", { name: new RegExp(`^Question ${index + 1},`) }).click();
      await expect(page.getByTestId("question-prompt")).toHaveText(questions[index].prompt);
      await choose(page, questions[index].correct!);
      await expect(page.getByText("Answer saved")).toBeVisible();
    }

    const { data: saved } = await db().from("test_answers").select("question_id, selected_answer").eq("test_session_id", session.id);
    expect(saved).toHaveLength(skipped);
    expect(saved!.find((a) => a.question_id === questions[0].id)!.selected_answer).toBe(questions[0].correct);

    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("1 question is unanswered");
    await page.getByRole("button", { name: "Yes, finish" }).click();

    await expect(page.getByTestId("session-summary")).toBeVisible();
    const expected = Math.round((skipped / questions.length) * 100);
    await expect(page.getByTestId("summary-score")).toHaveText(`${expected}%`);
    await expect(page.getByTestId("summary-counts")).toContainText(`${skipped} correct out of ${questions.length} · ${skipped} answered`);
    // Now, and only now, the missed (unanswered) question is revealed with its key.
    await expect(page.getByTestId("review-item")).toHaveCount(1);
    await expect(page.getByTestId("review-item")).toContainText("Not answered");
    await expect(page.getByTestId("review-item")).toContainText(questions[skipped].correct!);

    // The finished exam appears in history marked as timed.
    await go(page, `${HOME}/progress`);
    await expect(page.getByTestId("session-history-row").first()).toContainText("timed exam");
  });

  test("the deadline is enforced by the server, not the browser clock", async ({ open, account }) => {
    const page = await open();
    await go(page, `${HOME}/practice/${await packId(INTEGRITY_PACK)}`);
    await page.getByRole("button", { name: /^Timed exam/ }).click();
    await expect(page.getByTestId("quiz-timer")).toBeVisible();
    const session = await latestSession(account.user.id);
    const questions = await pinned(session.id);

    // The clock "runs out" on the server while the page still shows time left.
    const past = new Date(Date.now() - 5000).toISOString();
    const { error } = await db().from("test_sessions").update({ expires_at: past }).eq("id", session.id);
    expect(error).toBeNull();

    await choose(page, questions[0].correct!);
    // The late answer is refused and the exam is closed for them.
    await expect(page.getByTestId("session-summary")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("summary-score")).toHaveText("0%");
    const { count } = await db().from("test_answers").select("id", { count: "exact", head: true }).eq("test_session_id", session.id);
    expect(count).toBe(0);
    const done = await latestSession(account.user.id);
    expect(done.completed_at).not.toBeNull();
    expect(done.correct_count).toBe(0);
  });

  test("the countdown finishes the exam by itself when time runs out", async ({ open, account }) => {
    // A short limit on the pack for this test only (restored afterwards), so the real countdown can reach zero.
    const id = await packId(INTEGRITY_PACK);
    const { data: original } = await db().from("question_packs").select("time_limit_seconds").eq("id", id).single();
    await db().from("question_packs").update({ time_limit_seconds: 6 }).eq("id", id);
    try {
      const page = await open();
      await go(page, `${HOME}/practice/${id}`);
      await page.getByRole("button", { name: /^Timed exam/ }).click();
      await expect(page.getByTestId("quiz-timer")).toBeVisible();
      const session = await latestSession(account.user.id);
      const questions = await pinned(session.id);
      await choose(page, questions[0].correct!);
      await expect(page.getByText("Answer saved")).toBeVisible();
      // No click on Finish: the page's own countdown reaches zero and closes the exam.
      await expect(page.getByTestId("session-summary")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("summary-score")).toHaveText(`${Math.round((1 / questions.length) * 100)}%`);
      expect((await latestSession(account.user.id)).completed_at).not.toBeNull();
    } finally {
      await db().from("question_packs").update({ time_limit_seconds: original!.time_limit_seconds }).eq("id", id);
    }
  });
});

// ---- exhibits and diagrams ----------------------------------------------------------------------------------------

test.describe("exhibits", () => {
  async function seen(page: Page, testId: string, total: number) {
    for (let step = 0; step < total; step++) {
      await expect(page.getByTestId("question-body")).toBeVisible();
      if (await page.getByTestId(testId).first().isVisible().catch(() => false)) return true;
      const next = page.getByRole("button", { name: "Next", exact: true });
      if (!(await next.isVisible().catch(() => false))) break;
      await next.click();
    }
    return false;
  }

  test("numerical questions show a real table and a chart with a text alternative", async ({ open }) => {
    const page = await open();
    await go(page, `${HOME}/practice/${await packId("charts-and-tables")}`);
    await page.getByRole("button", { name: /^Practice/ }).click();

    expect(await seen(page, "exhibit-table", 20)).toBe(true);
    const table = page.getByTestId("exhibit-table").locator("table");
    await expect(table.locator("caption")).not.toBeEmpty();
    await expect(table.getByRole("columnheader").first()).toBeVisible();
    await expect(table.getByRole("rowheader").first()).toBeVisible();

    // The pack mixes tables and charts in either order: go back to the start and look for a chart.
    const previous = page.getByRole("button", { name: "Previous" });
    while (await previous.isEnabled()) await previous.click();
    expect(await seen(page, "exhibit-bar-chart", 20)).toBe(true);
    const chart = page.getByTestId("exhibit-bar-chart");
    await expect(chart.getByRole("img")).toHaveAttribute("aria-label", /.+\d/);
    await expect(chart.locator("table.sr-only")).toHaveCount(1);
  });

  test("diagrammatic questions draw the figures, name them for screen readers and offer labelled picture options", async ({ open }) => {
    const page = await open();
    await go(page, `${HOME}/practice/${await packId("matrices-and-odd-one-out")}`);
    await page.getByRole("button", { name: /^Practice/ }).click();

    expect(await seen(page, "exhibit-shapes", 12)).toBe(true);
    const exhibit = page.getByTestId("exhibit-shapes").first();
    await expect(exhibit).toHaveAttribute("aria-label", /Figure 1/);
    await expect(exhibit.getByRole("img").first()).toHaveAttribute("aria-label", /.+/);
    const options = page.getByRole("radiogroup").getByRole("radio");
    expect(await options.count()).toBeGreaterThanOrEqual(4);
    await expect(page.getByRole("radio", { name: "Option A", exact: true })).toHaveCount(1);
    // Each option picture is described in words too.
    const optionLabel = page.locator("label", { has: page.getByRole("radio", { name: "Option A", exact: true }) });
    await expect(optionLabel.getByRole("img")).toHaveAttribute("aria-label", /.+/);
    await page.screenshot({ path: "test-results/test-prep-diagrammatic.png", fullPage: true });
  });
});

// ---- daily five and streak ----------------------------------------------------------------------------------------

test.describe("daily five", () => {
  const localDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  };

  test("one question per format, resumable, streak grows, and only one per day", async ({ open, account }) => {
    test.setTimeout(180_000);
    // Two earlier days already completed -> finishing today makes a 3-day streak.
    await db()
      .from("daily_practice_completions")
      .insert([localDate(-1), localDate(-2)].map((local_date) => ({ user_id: account.user.id, local_date, correct_count: 3, total_questions: 5 })));

    const page = await open();
    await go(page, HOME);
    await expect(page.getByTestId("daily-streak")).toHaveText("2-day streak");

    await go(page, `${HOME}/daily`);
    await page.getByRole("button", { name: "Start today's five" }).click();
    await expect(page.getByTestId("quiz-progress")).toContainText("0 of 5 answered");

    const session = await latestSession(account.user.id);
    expect(session.is_daily).toBe(true);
    expect(session.daily_local_date).toBe(localDate(0));
    const questions = await pinned(session.id);
    expect(questions).toHaveLength(5);

    // One from each of the five test types.
    const { data: rows } = await db().from("questions").select("id, question_packs(test_type_id)").in("id", questions.map((q) => q.id));
    const types = new Set(rows!.map((row) => (Array.isArray(row.question_packs) ? row.question_packs[0] : row.question_packs)!.test_type_id));
    expect(types.size).toBe(5);

    // Answer two, leave, come back: the same five, with those two kept.
    await answerPractice(page, questions[0], true);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await answerPractice(page, questions[1], false);

    await go(page, `${HOME}/daily`);
    await page.getByRole("button", { name: "Start today's five" }).click();
    await expect(page.getByTestId("quiz-progress")).toContainText("2 of 5 answered");
    const { count: dailySessions } = await db().from("test_sessions").select("id", { count: "exact", head: true }).eq("user_id", account.user.id).eq("is_daily", true);
    expect(dailySessions).toBe(1);
    await expect(page.getByTestId("question-prompt")).toHaveText(questions[0].prompt);

    // Finish the remaining three (the resumed view starts on question 1, so walk to 3).
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    for (let index = 2; index < 5; index++) {
      await answerPractice(page, questions[index], true);
      if (index < 4) await page.getByRole("button", { name: "Next", exact: true }).click();
    }
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page.getByTestId("summary-score")).toHaveText("80%");

    const { data: completions } = await db().from("daily_practice_completions").select("local_date, correct_count, total_questions").eq("user_id", account.user.id).eq("local_date", localDate(0));
    expect(completions).toEqual([{ local_date: localDate(0), correct_count: 4, total_questions: 5 }]);

    // The dashboard-facing card: a 3-day streak, done for today.
    await go(page, HOME);
    await expect(page.getByTestId("daily-streak")).toHaveText("3-day streak");
    await expect(page.getByTestId("daily-card")).toContainText("Completed today");
    await expect(page.getByTestId("daily-card")).toContainText("longest 3 days");
    await expect(page.getByTestId("daily-card").locator("[data-completed='true']")).toHaveCount(3);

    // A second attempt the same day is refused politely and creates nothing.
    await go(page, `${HOME}/daily`);
    await page.getByRole("button", { name: "Start today's five" }).click();
    await expect(page.getByTestId("daily-done")).toBeVisible();
    const { count: after } = await db().from("test_sessions").select("id", { count: "exact", head: true }).eq("user_id", account.user.id).eq("is_daily", true);
    expect(after).toBe(1);
  });
});

// ---- subtype accuracy, weak areas, recommendations ----------------------------------------------------------------

test.describe("progress analytics", () => {
  test("accuracy by topic, weak-area flag, recommended practice, and a focused session on that topic", async ({ open, account }) => {
    test.setTimeout(180_000);
    const { data: type } = await db().from("test_types").select("id").eq("slug", "numerical-reasoning").single();
    const { data: seedQuestions } = await db().from("questions").select("id, options, correct_answer, difficulty, subtype, question_packs!inner(test_type_id)").eq("subtype", "Profit and margin").eq("is_active", true);
    expect(seedQuestions!.length).toBeGreaterThanOrEqual(5);

    // A completed session in which only one of these was answered correctly.
    const { data: seeded } = await db()
      .from("test_sessions")
      .insert({ user_id: account.user.id, question_pack_id: await packId("percentages-and-change"), total_questions: seedQuestions!.length, correct_count: 1, score: Math.round(100 / seedQuestions!.length), completed_at: new Date().toISOString() })
      .select("id")
      .single();
    await db().from("test_answers").insert(
      seedQuestions!.map((q, index) => ({
        test_session_id: seeded!.id,
        question_id: q.id,
        user_id: account.user.id,
        selected_answer: index === 0 ? q.correct_answer : (q.options as string[]).find((o) => o !== q.correct_answer),
        is_correct: index === 0,
        test_type_id: type!.id,
        subtype: q.subtype,
        difficulty: q.difficulty,
      })),
    );

    const page = await open();
    await go(page, `${HOME}/progress`);

    const row = page.getByTestId("topic-row").filter({ hasText: "Profit and margin" });
    await expect(row).toHaveAttribute("data-weak", "true");
    await expect(row).toContainText("Weak area");
    await expect(row).toContainText(`1/${seedQuestions!.length}`);
    await expect(row).toContainText(/easy|medium|hard/);

    // Format accuracy: numerical has answers, an unattempted format says so.
    await expect(page.getByTestId("type-accuracy-row").filter({ hasText: "Numerical" })).toContainText("accuracy over");

    const weak = page.getByTestId("recommendation-weak").filter({ hasText: "Profit and margin" });
    await expect(weak).toBeVisible();
    await weak.getByRole("link", { name: "Practise this" }).click();

    await expect(page.getByTestId("focus-start")).toContainText("Profit and margin");
    await page.getByRole("button", { name: "Start focused practice" }).click();
    await expect(page.getByTestId("quiz-progress")).toContainText(`0 of ${seedQuestions!.length} answered`);
    const focus = await latestSession(account.user.id);
    expect(focus.focus_subtype).toBe("Profit and margin");
    expect(focus.question_pack_id).toBeNull();
    const served = await pinned(focus.id);
    // Only that topic; the ones answered wrongly before come first, the one already right last.
    const { data: servedRows } = await db().from("questions").select("id, subtype").in("id", served.map((s) => s.id));
    expect(servedRows!.every((r) => r.subtype === "Profit and margin")).toBe(true);
    expect(served[served.length - 1].id).toBe(seedQuestions![0].id);

    await runPractice(page, served);
    await expect(page.getByTestId("summary-score")).toHaveText("100%");
  });
});

// ---- server-side gating while a page is open ----------------------------------------------------------------------

test.describe("plan changes mid-session", () => {
  test("if the plan lapses while a session is open, the next answer is refused by the server", async ({ open, account }) => {
    const page = await open();
    await go(page, `${HOME}/practice/${await packId(INTEGRITY_PACK)}`);
    await page.getByRole("button", { name: /^Practice/ }).click();
    await expect(page.getByTestId("question-body")).toBeVisible();
    const session = await latestSession(account.user.id);
    const questions = await pinned(session.id);
    await expect(page.getByTestId("question-prompt")).toHaveText(questions[0].prompt);

    await db().from("subscriptions").delete().eq("user_id", account.user.id);
    try {
      await choose(page, questions[0].correct!);
      await page.getByRole("button", { name: "Submit answer" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Premium and Elite" })).toBeVisible();
      const { count } = await db().from("test_answers").select("id", { count: "exact", head: true }).eq("test_session_id", session.id);
      expect(count).toBe(0);
      await go(page, HOME);
      await expect(page.getByTestId("test-prep-locked")).toBeVisible();
    } finally {
      await setPlan(account.user.id, "premium");
    }
  });
});

// ---- admin ----------------------------------------------------------------------------------------------------------

test.describe("admin: catalogue management", () => {
  test.afterAll(async () => {
    // Deleting the type cascades to its packs, questions and (set-null) any answers.
    await db().from("test_types").delete().eq("slug", ADMIN_TYPE_SLUG);
  });

  test("a restricted admin without the permission is turned away", async ({ browser }) => {
    const user = await createIsolatedUser({ fullName: "Limited Admin" });
    await markOnboarded(user.id);
    await db().from("profiles").update({ role: "admin" }).eq("id", user.id);
    const { data: role } = await db().from("admin_roles").insert({ slug: `e2e-limited-${Date.now()}`, name: "E2E limited", permissions: ["manage_users"] }).select("id").single();
    await db().from("admin_user_roles").insert({ user_id: user.id, admin_role_id: role!.id });
    const { context, page } = await loginContext(browser, user);
    try {
      await page.waitForURL(/\/admin/);
      await page.goto("/admin/test-prep");
      await expect(page).toHaveURL(/\/admin$/);
      await page.goto("/admin/test-prep/test-types/new");
      await expect(page).toHaveURL(/\/admin$/);
    } finally {
      await context.close();
      await deleteIsolatedUser(user.id);
      await db().from("admin_roles").delete().eq("id", role!.id);
    }
  });

  test("create a test type, a pack and questions (with an exhibit), import more, then a learner practises them", async ({ browser, open }) => {
    test.setTimeout(240_000);
    const admin = await createIsolatedUser({ fullName: "Prep Super Admin" });
    await makeSuperAdmin(admin.id);
    const { context, page } = await loginContext(browser, admin);
    try {
      await page.waitForURL(/\/admin/);
      await dismissCookieBanner(page);

      // Test type
      await page.goto("/admin/test-prep/test-types/new");
      await page.getByLabel("Name").fill("E2E Reasoning");
      await page.getByLabel("Slug").fill(ADMIN_TYPE_SLUG);
      await page.getByRole("button", { name: "Create test type" }).click();
      await page.waitForURL(/\/admin\/test-prep$/);
      await expect(page.getByText("E2E Reasoning")).toBeVisible();
      const { data: type } = await db().from("test_types").select("id").eq("slug", ADMIN_TYPE_SLUG).single();

      // Pack (with a time limit)
      await page.goto(`/admin/test-prep/packs/new?testTypeId=${type!.id}`);
      await page.getByLabel("Name").fill("E2E Pack");
      await page.getByLabel("Slug").fill("e2e-pack");
      await page.getByLabel("Time limit, seconds (optional)").fill("300");
      await page.getByRole("button", { name: "Create pack" }).click();
      await page.waitForURL(new RegExp(`/admin/test-prep/test-types/${type!.id}`));
      const { data: pack } = await db().from("question_packs").select("id, time_limit_seconds").eq("slug", "e2e-pack").single();
      expect(pack!.time_limit_seconds).toBe(300);

      // A question with a table exhibit; the live preview renders it and flags a bad option match
      await page.goto(`/admin/test-prep/questions/new?packId=${pack!.id}`);
      await page.getByLabel("Prompt").fill("Which region earned the most?");
      await page.getByLabel("Options").fill("North\nSouth\nEast");
      await page.getByLabel("Correct answer").fill("Sout");
      await expect(page.getByText("doesn't exactly match any option yet")).toBeVisible();
      await page.getByLabel("Correct answer").fill("South");
      await page.getByLabel("Explanation (shown after answering)").fill("South has 180, which is more than North's 120 or East's 90.");
      await page.getByLabel(/^Topic/).fill("Table reading");
      await page.getByLabel(/^Exhibit/).fill("{bad");
      await expect(page.getByText("Not valid JSON yet.")).toBeVisible();
      await page.getByLabel(/^Exhibit/).fill(JSON.stringify({ kind: "table", caption: "Revenue (£000)", headers: ["Region", "Revenue"], rows: [["North", "120"], ["South", "180"], ["East", "90"]] }));
      await expect(page.getByTestId("question-preview").getByTestId("exhibit-table")).toBeVisible();
      await page.getByRole("button", { name: "Create question" }).click();
      await page.waitForURL(new RegExp(`/admin/test-prep/packs/${pack!.id}$`));
      await expect(page.getByTestId("admin-question-row")).toHaveCount(1);

      // Server-side validation refuses a correct answer that isn't an option, whatever the browser allowed
      await page.goto(`/admin/test-prep/questions/new?packId=${pack!.id}`);
      await page.getByLabel("Prompt").fill("Invalid one");
      await page.getByLabel("Options").fill("A\nB");
      await page.getByLabel("Correct answer").fill("C");
      await page.getByRole("button", { name: "Create question" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "exactly match" })).toBeVisible();

      // Duplicate (created inactive), toggle, filter
      await page.goto(`/admin/test-prep/packs/${pack!.id}`);
      await page.getByRole("button", { name: "Duplicate question" }).click();
      await expect(page.getByTestId("admin-question-row")).toHaveCount(2);
      await expect(page.getByTestId("admin-question-row").filter({ hasText: "Inactive" })).toHaveCount(1);
      await page.getByTestId("admin-question-row").filter({ hasText: "Inactive" }).getByRole("button", { name: "Activate question" }).click();
      await expect(page.getByTestId("admin-question-row").filter({ hasText: "Inactive" })).toHaveCount(0);
      await page.getByTestId("admin-question-row").last().getByRole("button", { name: "Deactivate question" }).click();
      await expect(page.getByTestId("admin-question-row").filter({ hasText: "Inactive" })).toHaveCount(1);
      await page.getByLabel("Search").fill("nothing matches this");
      await expect(page.getByTestId("question-count")).toContainText("Showing 0 of 2");
      await page.getByLabel("Search").fill("");
      await expect(page.getByTestId("question-count")).toContainText("Showing 2 of 2");

      // Import: an invalid batch reports the offending question and imports nothing; a valid one imports all-or-nothing
      await page.getByRole("link", { name: "Import JSON" }).click();
      const bad = JSON.stringify([
        { prompt: "Fine one", options: ["a", "b"], correctAnswer: "a" },
        { prompt: "Broken one", options: ["a", "b"], correctAnswer: "z" },
      ]);
      await page.getByLabel("Questions (JSON array)").fill(bad);
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await expect(page.getByTestId("import-errors")).toContainText("Question 2");
      await expect(page.getByTestId("import-errors")).toContainText("nothing was imported");
      expect((await db().from("questions").select("id", { count: "exact", head: true }).eq("question_pack_id", pack!.id)).count).toBe(2);

      const good = JSON.stringify(
        [1, 2].map((n) => ({ prompt: `Imported question ${n}: what is ${n} + ${n}?`, options: [String(n), String(n + n), String(n * 3)], correctAnswer: String(n + n), explanation: `${n} plus ${n} is ${n + n}.`, subtype: "Arithmetic", difficulty: "easy" })),
      );
      await page.getByLabel("Questions (JSON array)").fill(good);
      await page.getByRole("button", { name: "Check" }).click();
      await expect(page.getByTestId("import-ok")).toContainText("All 2 questions are valid");
      expect((await db().from("questions").select("id", { count: "exact", head: true }).eq("question_pack_id", pack!.id)).count).toBe(2);
      await page.getByRole("button", { name: "Import", exact: true }).click();
      await page.waitForURL(new RegExp(`/admin/test-prep/packs/${pack!.id}$`));
      await expect(page.getByTestId("admin-question-row")).toHaveCount(4);

      // Every change above was audit-logged with who did it
      const { data: audit } = await db().from("admin_audit_logs").select("action, actor_id").eq("actor_id", admin.id).eq("entity_type", "test_prep");
      const actions = new Set(audit!.map((entry) => entry.action));
      for (const action of ["test_prep.type_create", "test_prep.question_create", "test_prep.question_duplicate", "test_prep.question_activate", "test_prep.question_deactivate", "test_prep.questions_import"]) {
        expect(actions.has(action), action).toBe(true);
      }

      // Learners see the new pack straight away, at the right size, and its questions grade against the admin's key.
      const learner = await open();
      await go(learner, HOME);
      const link = learner.getByTestId("pack-link").filter({ hasText: "E2E Pack" });
      await expect(link).toContainText("3 questions"); // 4 rows, one deliberately inactive
      await link.click();
      await learner.getByRole("button", { name: /^Practice/ }).click();
      await expect(learner.getByTestId("question-body")).toBeVisible();
      const { data: learnerSession } = await db().from("test_sessions").select("id").eq("question_pack_id", pack!.id).single();
      const served = await pinned(learnerSession!.id);
      expect(served).toHaveLength(3);
      await runPractice(learner, served);
      await expect(learner.getByTestId("summary-score")).toHaveText("100%");
      await go(learner, `${HOME}/progress`);
      await expect(learner.getByTestId("topic-row").filter({ hasText: "Arithmetic" })).toBeVisible();

      // Delete a question
      await page.goto(`/admin/test-prep/packs/${pack!.id}`);
      page.once("dialog", (dialog) => void dialog.accept());
      await page.getByTestId("admin-question-row").first().getByRole("button", { name: "Delete question" }).click();
      await expect(page.getByTestId("admin-question-row")).toHaveCount(3);
    } finally {
      await context.close();
      await deleteIsolatedUser(admin.id);
    }
  });
});
