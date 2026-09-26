"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gateTestPrep } from "@/lib/test-prep/access";
import { getPinnedQuestions, getGradedAnswers, isPinned, pinSessionQuestions } from "@/lib/test-prep/session-data";
import { loadQuestionHistory } from "@/lib/test-prep/history-data";
import { pickFocus, type Candidate } from "@/lib/test-prep/selection";
import { listActiveQuestions } from "@/lib/test-prep/queries";
import { startSessionSchema, startFocusedSessionSchema, submitAnswerSchema, completeSessionSchema, reviewSessionSchema } from "@/lib/test-prep/practice/schemas";
import type {
  AnsweredState,
  CompleteSessionResult,
  SavedAnswer,
  SessionResult,
  SessionReview,
  StartSessionResult,
  SubmitAnswerResult,
} from "@/lib/test-prep/practice/types";

const FOCUS_SESSION_SIZE = 10;
const MIN_FOCUS_QUESTIONS = 3;

/**
 * Starts a pack session. Every entry point here checks the plan first (src/lib/test-prep/access.ts).
 *
 * The session is created with the exact questions it will serve (test_session_questions), so `total_questions`, the
 * order, and what an answer may be submitted for are all fixed at this moment — a pack gaining or losing questions later
 * never changes an attempt in progress.
 *
 * Timed mode: `expires_at` is the pack's own `time_limit_seconds` read fresh from the database and turned into an
 * absolute deadline stored on the row (migration 0070). The client only displays it; submitAnswer re-checks it on every
 * answer, so a late answer is refused whatever the browser's clock says. A timed session also never sends the answer
 * key or explanations while the clock is running (see submitAnswer).
 */
export async function startTestSession(input: { questionPackId: string; mode?: "practice" | "timed" }): Promise<StartSessionResult> {
  const user = await requireUser();
  const locked = await gateTestPrep(user.id);
  if (locked) return locked;

  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: pack, error: packError } = await supabase
    .from("question_packs")
    .select("id, time_limit_seconds, is_active")
    .eq("id", parsed.data.questionPackId)
    .maybeSingle();
  if (packError || !pack || !pack.is_active) return { error: "That pack couldn't be found." };
  if (parsed.data.mode === "timed" && !pack.time_limit_seconds) return { error: "This pack has no time limit, so it can only be practised untimed." };

  const questions = await listActiveQuestions(pack.id);
  if (questions.length === 0) return { error: "This pack has no active questions yet." };

  // Results are written by the server only (migration 0110): a user can read their own rows but never write them.
  const admin = createAdminClient();
  const startedAt = new Date();
  const expiresAt = parsed.data.mode === "timed" && pack.time_limit_seconds ? new Date(startedAt.getTime() + pack.time_limit_seconds * 1000) : null;

  const { data: session, error } = await admin
    .from("test_sessions")
    .insert({
      user_id: user.id,
      question_pack_id: pack.id,
      mode: parsed.data.mode,
      total_questions: questions.length,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !session) return { error: "Couldn't start that practice session — try again." };

  if (!(await pinSessionQuestions(admin, session.id, user.id, questions.map((question) => question.id)))) {
    await admin.from("test_sessions").delete().eq("id", session.id);
    return { error: "Couldn't start that practice session — try again." };
  }

  return {
    sessionId: session.id,
    mode: parsed.data.mode,
    totalQuestions: questions.length,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    questions,
    answers: [],
    savedAnswers: [],
  };
}

/**
 * Focused practice on one topic (a subtype within a test type), across every pack that has it: the questions you have
 * never seen first, then ones you last got wrong (src/lib/test-prep/selection.ts). This is what the weak-area
 * recommendations link to.
 */
export async function startFocusedPractice(input: { testTypeId: string; subtype: string }): Promise<StartSessionResult> {
  const user = await requireUser();
  const locked = await gateTestPrep(user.id);
  if (locked) return locked;

  const parsed = startFocusedSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: packs } = await supabase.from("question_packs").select("id").eq("test_type_id", parsed.data.testTypeId).eq("is_active", true);
  const packIds = (packs ?? []).map((pack) => pack.id);
  if (packIds.length === 0) return { error: "That topic has no practice questions yet." };

  let query = supabase.from("questions").select("id, question_pack_id").in("question_pack_id", packIds).eq("is_active", true);
  query = parsed.data.subtype === "General" ? query.is("subtype", null) : query.eq("subtype", parsed.data.subtype);
  const { data: pool, error: poolError } = await query;
  if (poolError) return { error: "Couldn't start that practice session — try again." };
  if (!pool || pool.length < MIN_FOCUS_QUESTIONS) return { error: "There aren't enough questions on that topic yet." };

  let history;
  try {
    history = await loadQuestionHistory(supabase);
  } catch {
    return { error: "Couldn't start that practice session — try again." };
  }
  const candidates: Candidate[] = pool.map((row) => ({ id: row.id, testTypeId: parsed.data.testTypeId, subtype: parsed.data.subtype }));
  const chosenIds = pickFocus(candidates, history, FOCUS_SESSION_SIZE);

  const admin = createAdminClient();
  const { data: session, error } = await admin
    .from("test_sessions")
    .insert({
      user_id: user.id,
      question_pack_id: null,
      mode: "practice",
      total_questions: chosenIds.length,
      focus_subtype: parsed.data.subtype,
      focus_test_type_id: parsed.data.testTypeId,
    })
    .select("id")
    .single();
  if (error || !session) return { error: "Couldn't start that practice session — try again." };

  if (!(await pinSessionQuestions(admin, session.id, user.id, chosenIds))) {
    await admin.from("test_sessions").delete().eq("id", session.id);
    return { error: "Couldn't start that practice session — try again." };
  }

  const questions = await getPinnedQuestions(admin, session.id);
  return { sessionId: session.id, mode: "practice", totalQuestions: questions.length, expiresAt: null, questions, answers: [], savedAnswers: [] };
}

/**
 * Grades one answer server-side and stores it. The answer key lives behind a column-level grant (migration 0067), so the
 * regular client genuinely can't read it — this goes through the service-role client and therefore checks ownership by
 * hand: the session must be the requester's, still open, inside its deadline, and the question must be one the session
 * was set (test_session_questions) — not merely any active question, which would let a session be used to look up
 * answers to questions it never served.
 *
 * Practice mode answers with immediate feedback, and a question already answered is not re-gradable (otherwise "see the
 * answer, then resubmit it" would inflate the score). Timed mode stores the answer and says nothing about it: no
 * correctness, no key, no explanation until the session is finished; until then an answer can be changed.
 *
 * The question's test type, subtype and difficulty are copied onto the answer row, so the learner's accuracy history
 * survives that question later being edited or deleted.
 */
export async function submitAnswer(input: { testSessionId: string; questionId: string; selectedAnswer?: string }): Promise<SubmitAnswerResult> {
  const user = await requireUser();
  const locked = await gateTestPrep(user.id);
  if (locked) return locked;

  const parsed = submitAnswerSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("test_sessions")
    .select("id, user_id, mode, completed_at, expires_at")
    .eq("id", parsed.data.testSessionId)
    .maybeSingle();
  if (sessionError || !session || session.user_id !== user.id) return { error: "That practice session couldn't be found." };
  if (session.completed_at) return { error: "This practice session has already finished." };
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) return { expired: true };

  if (!(await isPinned(admin, session.id, parsed.data.questionId))) return { error: "That question doesn't belong to this session." };

  const { data: question, error: questionError } = await admin
    .from("questions")
    .select("id, question_pack_id, question_type, options, correct_answer, explanation, subtype, difficulty")
    .eq("id", parsed.data.questionId)
    .maybeSingle();
  if (questionError || !question) return { error: "That question doesn't belong to this session." };

  // A choice must be one of the options actually offered; anything else is a forged request, not a wrong answer.
  if (question.question_type !== "free_text" && parsed.data.selectedAnswer !== null && !(question.options as string[]).includes(parsed.data.selectedAnswer)) {
    return { error: "That isn't one of the options for this question." };
  }

  const timed = session.mode === "timed";

  if (!timed) {
    const { data: existing } = await admin
      .from("test_answers")
      .select("selected_answer, is_correct")
      .eq("test_session_id", session.id)
      .eq("question_id", question.id)
      .maybeSingle();
    if (existing) {
      return { questionId: question.id, selectedAnswer: existing.selected_answer, isCorrect: existing.is_correct, correctAnswer: question.correct_answer, explanation: question.explanation };
    }
  }

  const isCorrect = question.correct_answer === null ? null : parsed.data.selectedAnswer !== null && parsed.data.selectedAnswer === question.correct_answer;

  const { data: pack } = question.question_pack_id
    ? await admin.from("question_packs").select("test_type_id").eq("id", question.question_pack_id).maybeSingle()
    : { data: null };

  const { error: upsertError } = await admin.from("test_answers").upsert(
    {
      test_session_id: session.id,
      question_id: question.id,
      user_id: user.id,
      selected_answer: parsed.data.selectedAnswer,
      is_correct: isCorrect,
      answered_at: new Date().toISOString(),
      test_type_id: pack?.test_type_id ?? null,
      subtype: question.subtype,
      difficulty: question.difficulty,
    },
    { onConflict: "test_session_id,question_id" },
  );
  if (upsertError) return { error: "Couldn't save that answer — try again." };

  if (timed) {
    const saved: SavedAnswer = { questionId: question.id, selectedAnswer: parsed.data.selectedAnswer, saved: true };
    return saved;
  }
  const answered: AnsweredState = {
    questionId: question.id,
    selectedAnswer: parsed.data.selectedAnswer,
    isCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
  };
  return answered;
}

async function summariseSession(sessionId: string, userId: string): Promise<{ result: SessionResult } | { error: string }> {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, total_questions, correct_count, score, started_at, completed_at")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!session || !session.completed_at) return { error: "That practice session couldn't be found." };
  const { count } = await supabase.from("test_answers").select("id", { count: "exact", head: true }).eq("test_session_id", session.id);
  return {
    result: {
      correctCount: session.correct_count ?? 0,
      answeredCount: count ?? 0,
      totalQuestions: session.total_questions,
      score: session.score ?? 0,
      startedAt: session.started_at,
      completedAt: session.completed_at,
    },
  };
}

/**
 * Scores the session from its own graded answers — never re-reads the key. Score is correct ÷ the session's fixed question
 * count, so a skipped question counts against you rather than being left out of the denominator. Rolls the result into
 * practice_progress (attempts, best score, last practised) for pack sessions. A duplicate "Finish" (double click, a retry)
 * returns the stored result instead of recomputing. Finishing is allowed after the deadline — only new answers are cut off.
 *
 * Returns the full review with the result: for every question, what was chosen, whether it was right, the key and the
 * explanation. That is the first time a timed session's key is revealed.
 */
export async function completeTestSession(input: { testSessionId: string }): Promise<CompleteSessionResult> {
  const user = await requireUser();
  const locked = await gateTestPrep(user.id);
  if (locked) return locked;

  const parsed = completeSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .select("id, question_pack_id, total_questions, completed_at")
    .eq("id", parsed.data.testSessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sessionError || !session) return { error: "That practice session couldn't be found." };

  if (!session.completed_at) {
    const { count: correctCount, error: countError } = await supabase
      .from("test_answers")
      .select("id", { count: "exact", head: true })
      .eq("test_session_id", session.id)
      .eq("is_correct", true);
    if (countError) return { error: "Couldn't finish that session — try again." };

    const score = session.total_questions > 0 ? Math.round(((correctCount ?? 0) / session.total_questions) * 100) : 0;
    // Only the first finisher wins: a second concurrent Finish finds it already completed and changes nothing.
    const admin = createAdminClient();
    const { data: updated, error: updateError } = await admin
      .from("test_sessions")
      .update({ completed_at: new Date().toISOString(), correct_count: correctCount ?? 0, score })
      .eq("id", session.id)
      .eq("user_id", user.id)
      .is("completed_at", null)
      .select("id")
      .maybeSingle();
    if (updateError) return { error: "Couldn't finish that session — try again." };

    if (updated && session.question_pack_id) {
      const { data: pack } = await supabase.from("question_packs").select("test_type_id").eq("id", session.question_pack_id).maybeSingle();
      if (pack) {
        const { data: progress } = await supabase
          .from("practice_progress")
          .select("attempts_count, best_score")
          .eq("user_id", user.id)
          .eq("test_type_id", pack.test_type_id)
          .maybeSingle();
        await admin.from("practice_progress").upsert(
          {
            user_id: user.id,
            test_type_id: pack.test_type_id,
            attempts_count: (progress?.attempts_count ?? 0) + 1,
            best_score: Math.max(progress?.best_score ?? 0, score),
            last_practiced_at: new Date().toISOString(),
          },
          { onConflict: "user_id,test_type_id" },
        );
      }
    }
  }

  return buildReview(session.id, user.id);
}

async function buildReview(sessionId: string, userId: string): Promise<Exclude<CompleteSessionResult, { error: string }> | { error: string }> {
  const summary = await summariseSession(sessionId, userId);
  if ("error" in summary) return summary;
  const admin = createAdminClient();
  let questions;
  try {
    questions = await getPinnedQuestions(admin, sessionId);
  } catch {
    return { error: "Couldn't load the results — try again." };
  }
  const answers = await getGradedAnswers(admin, sessionId, questions.map((question) => question.id));
  return { ...summary.result, questions, answers };
}

/** A finished session again, in full — the history page's "review". Refuses a session that isn't finished (its key must stay hidden) or isn't yours. */
export async function getSessionReview(input: { testSessionId: string }): Promise<SessionReview> {
  const user = await requireUser();
  const locked = await gateTestPrep(user.id);
  if (locked) return locked;

  const parsed = reviewSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("test_sessions")
    .select("id, mode, is_daily, focus_subtype, expires_at, completed_at, question_pack_id, question_packs(name)")
    .eq("id", parsed.data.testSessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session || !session.completed_at) return { error: "That practice session couldn't be found." };

  const review = await buildReview(session.id, user.id);
  if ("error" in review) return review;
  const pack = (Array.isArray(session.question_packs) ? session.question_packs[0] : session.question_packs) as { name: string } | null;
  return {
    ...review,
    meta: {
      sessionId: session.id,
      mode: session.mode,
      isDaily: session.is_daily,
      focusSubtype: session.focus_subtype,
      packName: pack?.name ?? null,
      expiresAt: session.expires_at,
    },
  };
}
