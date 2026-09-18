"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listActiveQuestionsAcrossAllPacks } from "@/lib/test-prep/queries";
import { getDailyPracticeStatusSchema, startDailyPracticeSchema, recordDailyCompletionSchema } from "@/lib/test-prep/daily/schemas";
import type { DailyPracticeDay, DailyPracticeStatus, StartDailyPracticeResult, RecordDailyCompletionResult } from "@/lib/test-prep/daily/types";

const DAILY_QUESTION_COUNT = 5;

// There's no stored per-user timezone preference anywhere in this app
// — every function below is handed the browser's own IANA zone name
// (`Intl.DateTimeFormat().resolvedOptions().timeZone`, read client-side
// since the server has no way to know a user's real local time) fresh
// on each call, which is what "timezone-safe" means here: the streak
// always reflects the caller's *current* local calendar day, and a
// day already recorded (daily_practice_completions.local_date) is
// stored as that resolved date, never rewritten if the caller's
// timezone later changes.

function isValidTimeZone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DD" for `date` in `timezone` — en-CA formats in ISO field order, which is also exactly what a Postgres `date` column expects. */
function localDateString(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * `days` before/after a "YYYY-MM-DD" string. Anchored to a neutral UTC
 * clock purely for the arithmetic (never re-interpreted against a real
 * timezone) — safe from DST because by the time this runs,
 * `localDateString` has already resolved the *real* local day once;
 * this is just calendar-day counting from that fixed string.
 */
function shiftDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Streak + last-14-days come from one query — every
 * daily_practice_completions row this user has (there's at most one
 * per calendar day ever, so this never grows large enough to need
 * paging) — rather than a 14-day-bounded one, since a real streak can
 * run longer than 14 days and truncating the lookback would understate
 * it.
 */
export async function getDailyPracticeStatus(input: { timezone: string }): Promise<DailyPracticeStatus | { error: string }> {
  const user = await requireUser();

  const parsed = getDailyPracticeStatusSchema.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) return { error: "Invalid request." };

  const todayLocal = localDateString(new Date(), parsed.data.timezone);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("daily_practice_completions")
    .select("local_date, correct_count, total_questions")
    .eq("user_id", user.id)
    .order("local_date", { ascending: false });
  if (error) return { error: "Couldn't load your practice streak — try again." };

  const byDate = new Map((data ?? []).map((row) => [row.local_date, row]));

  const last14Days: DailyPracticeDay[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = shiftDateString(todayLocal, -i);
    const row = byDate.get(date);
    last14Days.push({ date, completed: !!row, correctCount: row?.correct_count ?? null, totalQuestions: row?.total_questions ?? null });
  }

  const completedToday = byDate.has(todayLocal);

  // Not having practised *yet* today doesn't zero out a streak that's
  // still alive until the local day actually ends — start the walk
  // from yesterday in that case, not today.
  let currentStreak = 0;
  let cursor = completedToday ? todayLocal : shiftDateString(todayLocal, -1);
  while (byDate.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDateString(cursor, -1);
  }

  return { completedToday, currentStreak, last14Days };
}

/**
 * Picks `DAILY_QUESTION_COUNT` random active questions from across
 * every active pack (src/lib/test-prep/queries.ts's own
 * listActiveQuestionsAcrossAllPacks) and opens a `test_sessions` row
 * with `question_pack_id: null, is_daily: true` for it. From here the
 * flow is the same generic submitAnswer/completeTestSession pipeline
 * the pack-based practice engine already uses — submitAnswer's own
 * pack-membership check is skipped for `is_daily` sessions (there's no
 * single pack to check against), so any active question is accepted;
 * harmless since the client only ever submits for the five it was
 * actually given, same trust level already accepted for pack-scoped
 * sessions (a learner could, with dev tools, submit for a question
 * they were never shown — this is practice, not a proctored exam).
 */
export async function startDailyPractice(input: { timezone: string }): Promise<StartDailyPracticeResult> {
  const user = await requireUser();

  const parsed = startDailyPracticeSchema.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) return { error: "Invalid request." };

  const todayLocal = localDateString(new Date(), parsed.data.timezone);

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("daily_practice_completions")
    .select("id")
    .eq("user_id", user.id)
    .eq("local_date", todayLocal)
    .maybeSingle();
  if (existingError) return { error: "Couldn't start today's practice — try again." };
  if (existing) return { alreadyCompletedToday: true };

  const pool = await listActiveQuestionsAcrossAllPacks();
  if (pool.length < DAILY_QUESTION_COUNT) return { error: "Not enough active questions for daily practice yet." };

  const questions = shuffled(pool).slice(0, DAILY_QUESTION_COUNT);

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .insert({ user_id: user.id, question_pack_id: null, total_questions: questions.length, is_daily: true })
    .select("id")
    .single();
  if (sessionError || !session) return { error: "Couldn't start today's practice — try again." };

  return { sessionId: session.id, questions };
}

/**
 * Called once the daily session's own completeTestSession has already
 * run — this just claims that result as today's streak day. Requires
 * the session to actually be `is_daily` (not any arbitrary completed
 * session the caller owns) and already completed, so a streak day can
 * only ever come from a real, server-validated daily attempt. `local_date`
 * is resolved from the session's own `completed_at` — the actual
 * server-recorded finish time — plus the caller's timezone, then
 * upserted with `ignoreDuplicates` so a duplicate call (double-click,
 * a retry) is a harmless no-op rather than an error or a second write.
 */
export async function recordDailyCompletion(input: { testSessionId: string; timezone: string }): Promise<RecordDailyCompletionResult> {
  const user = await requireUser();

  const parsed = recordDailyCompletionSchema.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) return { error: "Invalid request." };

  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("test_sessions")
    .select("id, is_daily, total_questions, correct_count, completed_at")
    .eq("id", parsed.data.testSessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (sessionError || !session) return { error: "That practice session couldn't be found." };
  if (!session.is_daily) return { error: "That session isn't a daily practice attempt." };
  if (!session.completed_at || session.correct_count === null) return { error: "Finish today's practice before recording it." };

  const localDate = localDateString(new Date(session.completed_at), parsed.data.timezone);

  const { error: upsertError } = await supabase.from("daily_practice_completions").upsert(
    {
      user_id: user.id,
      test_session_id: session.id,
      local_date: localDate,
      correct_count: session.correct_count,
      total_questions: session.total_questions,
      completed_at: session.completed_at,
    },
    { onConflict: "user_id,local_date", ignoreDuplicates: true },
  );
  if (upsertError) return { error: "Couldn't save today's streak — try again." };

  return { localDate };
}
