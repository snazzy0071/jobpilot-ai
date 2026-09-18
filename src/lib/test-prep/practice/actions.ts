"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startSessionSchema, submitAnswerSchema, completeSessionSchema } from "@/lib/test-prep/practice/schemas";
import type { StartSessionResult, SubmitAnswerResult, CompleteSessionResult } from "@/lib/test-prep/practice/types";

/**
 * Creates a new attempt — `total_questions` is a real snapshot (the
 * pack's current active question count), not recomputed later, so a
 * pack gaining or losing questions after this session starts never
 * rewrites what this specific attempt was actually scored out of (same
 * reasoning migration 0067's own comment gives for that column).
 *
 * `expires_at` (migration 0070) is the same idea applied to timing: the
 * pack's own `time_limit_seconds` is read fresh from the database here
 * — never taken from anything the client passed in — and turned into an
 * absolute deadline stored on the row. That's what makes the time limit
 * "server-safe": the client only ever gets told the deadline that was
 * actually recorded, and every later action re-checks against this
 * same stored value instead of trusting a client-side countdown.
 * Regular client throughout: reading a public pack row, counting active
 * questions, and inserting a session the user owns needs no elevated
 * access.
 */
export async function startTestSession(input: { questionPackId: string }): Promise<StartSessionResult> {
  const user = await requireUser();

  const parsed = startSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();

  const { data: pack, error: packError } = await supabase
    .from("question_packs")
    .select("time_limit_seconds")
    .eq("id", parsed.data.questionPackId)
    .maybeSingle();
  if (packError || !pack) return { error: "That pack couldn't be found." };

  const { count, error: countError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("question_pack_id", parsed.data.questionPackId)
    .eq("is_active", true);
  if (countError) return { error: "Couldn't start that practice session — try again." };

  const totalQuestions = count ?? 0;
  if (totalQuestions === 0) return { error: "This pack has no active questions yet." };

  const startedAt = new Date();
  const expiresAt = pack.time_limit_seconds ? new Date(startedAt.getTime() + pack.time_limit_seconds * 1000) : null;

  const { data, error } = await supabase
    .from("test_sessions")
    .insert({
      user_id: user.id,
      question_pack_id: parsed.data.questionPackId,
      total_questions: totalQuestions,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't start that practice session — try again." };

  return { sessionId: data.id, totalQuestions, expiresAt: expiresAt ? expiresAt.toISOString() : null };
}

/**
 * Grades one answer server-side and stores it — the only place in this
 * app that reads `questions.correct_answer`/`explanation` outside the
 * admin CRUD, and for the same reason: that column-level grant
 * (migration 0067) means the regular client genuinely can't read them,
 * so this has to go through the service-role client
 * (src/lib/supabase/admin.ts). Because that bypasses RLS entirely,
 * ownership is checked by hand here instead — the session must belong
 * to the requesting user, and the question must actually belong to
 * that session's own pack — before anything is read or written.
 *
 * Upserts on `(test_session_id, question_id)` (migration 0067's own
 * unique constraint), so revisiting a question via "Previous" and
 * changing the answer is a real, supported action, not a duplicate
 * row — this is practice, not a proctored exam, so answers stay
 * editable until the session is completed.
 *
 * `free_text` (or any question with no `correct_answer` at all) grades
 * as `isCorrect: null` — genuinely ungraded, never coerced to a
 * guessed true/false.
 *
 * Enforces the session's own `expires_at` (migration 0070) before
 * grading anything: a submission arriving after that stored deadline
 * is rejected outright — never graded, never written to
 * `test_answers` — regardless of what the client's own countdown
 * displayed. This is the actual server-side half of "server-safe start/
 * end times"; the client-side timer is just a UX mirror of this check.
 *
 * The pack-membership check below only applies to ordinary,
 * single-pack sessions. A daily-practice session (migration 0071's
 * `is_daily`, src/lib/test-prep/daily/actions.ts) has `question_pack_id:
 * null` by design — it's a mix across every active pack, not one — so
 * there's no single pack to check a question against; any active
 * question is accepted instead, same trust level as every other
 * question this session offers.
 */
export async function submitAnswer(input: {
  testSessionId: string;
  questionId: string;
  selectedAnswer?: string;
}): Promise<SubmitAnswerResult> {
  const user = await requireUser();

  const parsed = submitAnswerSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .select("id, user_id, question_pack_id, is_daily, completed_at, expires_at")
    .eq("id", parsed.data.testSessionId)
    .maybeSingle();
  if (sessionError || !session || session.user_id !== user.id) return { error: "That practice session couldn't be found." };
  if (session.completed_at) return { error: "This practice session has already finished." };
  if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) return { expired: true };

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("id, question_pack_id, question_type, is_active, correct_answer, explanation")
    .eq("id", parsed.data.questionId)
    .maybeSingle();
  if (questionError || !question) return { error: "That question doesn't belong to this session." };
  if (session.is_daily ? !question.is_active : question.question_pack_id !== session.question_pack_id) {
    return { error: "That question doesn't belong to this session." };
  }

  const isCorrect =
    question.correct_answer === null
      ? null
      : parsed.data.selectedAnswer !== null && parsed.data.selectedAnswer === question.correct_answer;

  const { error: upsertError } = await supabase.from("test_answers").upsert(
    {
      test_session_id: parsed.data.testSessionId,
      question_id: parsed.data.questionId,
      user_id: user.id,
      selected_answer: parsed.data.selectedAnswer,
      is_correct: isCorrect,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "test_session_id,question_id" },
  );
  if (upsertError) return { error: "Couldn't save that answer — try again." };

  return {
    questionId: parsed.data.questionId,
    selectedAnswer: parsed.data.selectedAnswer,
    isCorrect,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
  };
}

/**
 * Scores the session from its own already-graded `test_answers`
 * (`is_correct`, set once each by submitAnswer above) — never
 * re-reads `correct_answer` itself, so the regular client is enough
 * here. Score is correct-count ÷ the session's own `total_questions`
 * snapshot, not ÷ questions actually answered — a skipped question
 * honestly counts against the score rather than being excluded from
 * the denominator.
 *
 * Rolls the result into `practice_progress` (attempts +1, best_score
 * kept as a real max, last_practiced_at bumped) via a plain read-then-
 * upsert — fine for this low-contention, one-session-at-a-time path,
 * unlike migration 0020's atomic usage consumption (a genuinely
 * concurrent, billing-critical one). Idempotent against a duplicate
 * "Finish" click: an already-completed session returns its real
 * stored result instead of recomputing or erroring.
 *
 * Callable at any time regardless of `expires_at` — completion itself
 * isn't time-gated, only new answers are (see submitAnswer). Whether
 * this was reached because a learner clicked "Finish" early, ran out of
 * questions, or the timer expired, it scores exactly what was
 * legitimately answered before that deadline, since submitAnswer is
 * what actually stops late answers from ever being stored.
 */
export async function completeTestSession(input: { testSessionId: string }): Promise<CompleteSessionResult> {
  const user = await requireUser();

  const parsed = completeSessionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .select("id, question_pack_id, total_questions, correct_count, score, started_at, completed_at")
    .eq("id", parsed.data.testSessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sessionError || !session) return { error: "That practice session couldn't be found." };

  if (session.completed_at) {
    const { count: answeredCount } = await supabase
      .from("test_answers")
      .select("id", { count: "exact", head: true })
      .eq("test_session_id", session.id);
    return {
      correctCount: session.correct_count ?? 0,
      answeredCount: answeredCount ?? 0,
      totalQuestions: session.total_questions,
      score: session.score ?? 0,
      startedAt: session.started_at,
      completedAt: session.completed_at,
    };
  }

  const { count: answeredCount, error: answeredCountError } = await supabase
    .from("test_answers")
    .select("id", { count: "exact", head: true })
    .eq("test_session_id", session.id);
  if (answeredCountError) return { error: "Couldn't finish that session — try again." };

  const { count: correctCount, error: countError } = await supabase
    .from("test_answers")
    .select("id", { count: "exact", head: true })
    .eq("test_session_id", session.id)
    .eq("is_correct", true);
  if (countError) return { error: "Couldn't finish that session — try again." };

  const score = session.total_questions > 0 ? Math.round(((correctCount ?? 0) / session.total_questions) * 100) : 0;
  const completedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("test_sessions")
    .update({ completed_at: completedAt, correct_count: correctCount ?? 0, score })
    .eq("id", session.id);
  if (updateError) return { error: "Couldn't finish that session — try again." };

  if (session.question_pack_id) {
    const { data: pack } = await supabase.from("question_packs").select("test_type_id").eq("id", session.question_pack_id).maybeSingle();
    if (pack) {
      const { data: existingProgress } = await supabase
        .from("practice_progress")
        .select("attempts_count, best_score")
        .eq("user_id", user.id)
        .eq("test_type_id", pack.test_type_id)
        .maybeSingle();

      await supabase.from("practice_progress").upsert(
        {
          user_id: user.id,
          test_type_id: pack.test_type_id,
          attempts_count: (existingProgress?.attempts_count ?? 0) + 1,
          best_score: Math.max(existingProgress?.best_score ?? 0, score),
          last_practiced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,test_type_id" },
      );
    }
  }

  return {
    correctCount: correctCount ?? 0,
    answeredCount: answeredCount ?? 0,
    totalQuestions: session.total_questions,
    score,
    startedAt: session.started_at,
    completedAt,
  };
}
