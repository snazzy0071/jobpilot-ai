"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gateTestPrep } from "@/lib/test-prep/access";
import { getGradedAnswers, getPinnedQuestions, pinSessionQuestions } from "@/lib/test-prep/session-data";
import { loadAccuracyRows, loadQuestionHistory } from "@/lib/test-prep/history-data";
import { aggregateTopics, findWeakAreas } from "@/lib/test-prep/accuracy";
import { pickDaily, type Candidate } from "@/lib/test-prep/selection";
import { computeStreaks, isValidTimeZone, localDateString, shiftDateString } from "@/lib/test-prep/daily/streak";
import { getDailyPracticeStatusSchema, startDailyPracticeSchema, recordDailyCompletionSchema } from "@/lib/test-prep/daily/schemas";
import type { DailyPracticeDay, DailyPracticeStatus, StartDailyPracticeResult, RecordDailyCompletionResult } from "@/lib/test-prep/daily/types";

const DAILY_QUESTION_COUNT = 5;

// There's no stored per-user timezone anywhere in this app — every function below is handed the browser's own IANA zone
// (`Intl.DateTimeFormat().resolvedOptions().timeZone`, which the server can't know) on each call, so the streak always
// reflects the caller's current local calendar day, and a day already recorded (daily_practice_completions.local_date)
// stays the date it was, whatever zone the caller is in later.

/** Streak, longest streak and the last 14 days, from one query: there's at most one completion per day, so this never grows large enough to need paging. */
export async function getDailyPracticeStatus(input: { timezone: string }): Promise<DailyPracticeStatus | { error: string; locked?: true }> {
  const user = await requireUser();
  const locked = await gateTestPrep(user.id);
  if (locked) return locked;

  const parsed = getDailyPracticeStatusSchema.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) return { error: "Invalid request." };

  const today = localDateString(new Date(), parsed.data.timezone);

  const supabase = await createClient();
  const [{ data, error }, { data: open }] = await Promise.all([
    supabase.from("daily_practice_completions").select("local_date, correct_count, total_questions").eq("user_id", user.id).order("local_date", { ascending: false }),
    supabase.from("test_sessions").select("id").eq("user_id", user.id).eq("is_daily", true).eq("daily_local_date", today).is("completed_at", null).maybeSingle(),
  ]);
  if (error) return { error: "Couldn't load your practice streak — try again." };

  const byDate = new Map((data ?? []).map((row) => [row.local_date, row]));
  const last14Days: DailyPracticeDay[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = shiftDateString(today, -i);
    const row = byDate.get(date);
    last14Days.push({ date, completed: !!row, correctCount: row?.correct_count ?? null, totalQuestions: row?.total_questions ?? null });
  }

  const streaks = computeStreaks([...byDate.keys()], today);
  return {
    completedToday: byDate.has(today),
    inProgressToday: !!open && !byDate.has(today),
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    totalDaysCompleted: streaks.totalDays,
    last14Days,
  };
}

/**
 * Today's five: one question from each test type, chosen by src/lib/test-prep/selection.ts (never-seen first, then last
 * got wrong, weighted toward topics you're weak in). The five are stored on the session (test_session_questions), so they
 * can't be swapped for easier ones, and there is one daily session per person per local day (unique index, migration
 * 0106): starting again the same day resumes the same five with the answers already given, instead of re-rolling.
 */
export async function startDailyPractice(input: { timezone: string }): Promise<StartDailyPracticeResult> {
  const user = await requireUser();
  const locked = await gateTestPrep(user.id);
  if (locked) return locked;

  const parsed = startDailyPracticeSchema.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) return { error: "Invalid request." };

  const today = localDateString(new Date(), parsed.data.timezone);
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: done, error: doneError } = await supabase.from("daily_practice_completions").select("id").eq("user_id", user.id).eq("local_date", today).maybeSingle();
  if (doneError) return { error: "Couldn't start today's practice — try again." };
  if (done) return { alreadyCompletedToday: true };

  const resume = async (sessionId: string): Promise<StartDailyPracticeResult> => {
    const questions = await getPinnedQuestions(admin, sessionId);
    const answers = await getGradedAnswers(admin, sessionId, questions.map((question) => question.id));
    return { sessionId, mode: "practice", totalQuestions: questions.length, expiresAt: null, questions, answers, savedAnswers: [], resumed: true };
  };

  const { data: existing } = await supabase.from("test_sessions").select("id").eq("user_id", user.id).eq("is_daily", true).eq("daily_local_date", today).is("completed_at", null).maybeSingle();
  if (existing) return resume(existing.id);

  // Candidates: every active question in an active pack, with its test type.
  const { data: packs } = await supabase.from("question_packs").select("id, test_type_id").eq("is_active", true);
  const typeByPack = new Map((packs ?? []).map((pack) => [pack.id, pack.test_type_id]));
  const { data: rows, error: poolError } = await supabase
    .from("questions")
    .select("id, question_pack_id, subtype")
    .in("question_pack_id", [...typeByPack.keys()])
    .eq("is_active", true);
  if (poolError) return { error: "Couldn't start today's practice — try again." };
  const candidates: Candidate[] = (rows ?? []).map((row) => ({ id: row.id, testTypeId: typeByPack.get(row.question_pack_id) as string, subtype: row.subtype }));
  if (candidates.length < DAILY_QUESTION_COUNT) return { error: "Not enough active questions for daily practice yet." };

  let histories;
  let weak: Set<string>;
  try {
    histories = await loadQuestionHistory(supabase);
    weak = new Set(findWeakAreas(aggregateTopics(await loadAccuracyRows(supabase))).map((topic) => topic.subtype));
  } catch {
    return { error: "Couldn't start today's practice — try again." };
  }
  const chosenIds = pickDaily(candidates, histories, weak, DAILY_QUESTION_COUNT);

  const { data: session, error: sessionError } = await admin
    .from("test_sessions")
    .insert({ user_id: user.id, question_pack_id: null, mode: "practice", total_questions: chosenIds.length, is_daily: true, daily_local_date: today })
    .select("id")
    .single();
  if (sessionError || !session) {
    // Lost a race with another tab: the unique index (one daily per day) refused this one — resume the other.
    if (sessionError?.code === "23505") {
      const { data: winner } = await supabase.from("test_sessions").select("id").eq("user_id", user.id).eq("is_daily", true).eq("daily_local_date", today).maybeSingle();
      if (winner) return resume(winner.id);
    }
    return { error: "Couldn't start today's practice — try again." };
  }

  if (!(await pinSessionQuestions(admin, session.id, user.id, chosenIds))) {
    await admin.from("test_sessions").delete().eq("id", session.id);
    return { error: "Couldn't start today's practice — try again." };
  }

  const questions = await getPinnedQuestions(admin, session.id);
  return { sessionId: session.id, mode: "practice", totalQuestions: questions.length, expiresAt: null, questions, answers: [], savedAnswers: [], resumed: false };
}

/**
 * Called once the daily session's own completeTestSession has run: claims that result as today's streak day. Requires the
 * session to really be a daily, finished one, so a streak day can only come from a genuine server-validated attempt.
 * `local_date` is the session's own daily_local_date — the day it was started and set — so finishing just after midnight
 * doesn't move it to a different day. A repeat call is a harmless no-op.
 */
export async function recordDailyCompletion(input: { testSessionId: string; timezone: string }): Promise<RecordDailyCompletionResult> {
  const user = await requireUser();
  const locked = await gateTestPrep(user.id);
  if (locked) return locked;

  const parsed = recordDailyCompletionSchema.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .select("id, is_daily, daily_local_date, total_questions, correct_count, completed_at")
    .eq("id", parsed.data.testSessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sessionError || !session) return { error: "That practice session couldn't be found." };
  if (!session.is_daily || !session.daily_local_date) return { error: "That session isn't a daily practice attempt." };
  if (!session.completed_at || session.correct_count === null) return { error: "Finish today's practice before recording it." };

  // Written by the server only (migration 0110) — the session above was read as the caller, so it is theirs and finished.
  const { error: upsertError } = await createAdminClient().from("daily_practice_completions").upsert(
    {
      user_id: user.id,
      test_session_id: session.id,
      local_date: session.daily_local_date,
      correct_count: session.correct_count,
      total_questions: session.total_questions,
      completed_at: session.completed_at,
    },
    { onConflict: "user_id,local_date", ignoreDuplicates: true },
  );
  if (upsertError) return { error: "Couldn't save today's streak — try again." };

  return { localDate: session.daily_local_date };
}
