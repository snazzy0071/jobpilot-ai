// Types for the daily-practice flow (src/lib/test-prep/daily/actions.ts) — a small surface of its own, although the quiz
// itself runs through the same session actions as pack practice.

import type { ActionError, StartedSession } from "@/lib/test-prep/practice/types";

export type DailyPracticeDay = {
  /** Local calendar date, "YYYY-MM-DD", in whatever timezone the caller supplied. */
  date: string;
  completed: boolean;
  correctCount: number | null;
  totalQuestions: number | null;
};

export type DailyPracticeStatus = {
  completedToday: boolean;
  /** Today's five were started but not finished — starting again resumes them. */
  inProgressToday: boolean;
  currentStreak: number;
  longestStreak: number;
  totalDaysCompleted: number;
  /** Oldest first — 13 days ago through today, 14 entries. */
  last14Days: DailyPracticeDay[];
};

export type StartDailyPracticeResult = ActionError | { alreadyCompletedToday: true } | (StartedSession & { resumed: boolean });

export type RecordDailyCompletionResult = ActionError | { localDate: string };
