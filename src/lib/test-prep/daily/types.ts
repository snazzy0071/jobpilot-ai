// Types for the daily-practice flow (src/lib/test-prep/daily/actions.ts)
// — a separate, smaller surface from src/lib/test-prep/practice's
// pack-based flow, even though both ultimately share the same
// test_sessions/test_answers tables and the same submitAnswer/
// completeTestSession actions for the actual quiz-taking part.

import type { Question } from "@/lib/test-prep/types";

export type DailyPracticeDay = {
  /** Local calendar date, "YYYY-MM-DD", in whatever timezone the caller supplied. */
  date: string;
  completed: boolean;
  correctCount: number | null;
  totalQuestions: number | null;
};

export type DailyPracticeStatus = {
  completedToday: boolean;
  currentStreak: number;
  /** Oldest first — 13 days ago through today, 14 entries. */
  last14Days: DailyPracticeDay[];
};

export type StartDailyPracticeResult =
  | { error: string }
  | { alreadyCompletedToday: true }
  | { sessionId: string; questions: Question[] };

export type RecordDailyCompletionResult = { error: string } | { localDate: string };
