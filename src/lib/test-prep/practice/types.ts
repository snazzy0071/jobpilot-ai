// Types for the practice-taking flow (src/lib/test-prep/practice/actions.ts) — what a Server Action hands back to the
// client at each step. Distinct from src/lib/test-prep/types.ts, which describes the stored shapes.

import type { Question, TestSessionMode } from "@/lib/test-prep/types";

/** Set when the plan doesn't include Test Prep — the UI shows the upgrade prompt instead of a generic error. */
export type ActionError = { error: string; locked?: true };

/**
 * The one place `correctAnswer`/`explanation` are ever sent to the client for a specific question. In practice mode that
 * is right after the question is answered; in timed mode it is only in the review returned when the session is finished,
 * so a timed attempt never reveals an answer while the clock is running (the server doesn't send it, not merely hides it).
 */
export type AnsweredState = {
  questionId: string;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  correctAnswer: string | null;
  explanation: string | null;
};

/** A timed-mode answer that was stored but is deliberately not graded on screen yet. */
export type SavedAnswer = { questionId: string; selectedAnswer: string | null; saved: true };

export type SubmitAnswerResult = ActionError | { expired: true } | AnsweredState | SavedAnswer;

export function isAnsweredState(result: SubmitAnswerResult): result is AnsweredState {
  return "isCorrect" in result;
}

export type StartedSession = {
  sessionId: string;
  mode: TestSessionMode;
  totalQuestions: number;
  /** The server's own deadline (migration 0070) for a timed session, null otherwise. The client's countdown is only a display of this. */
  expiresAt: string | null;
  /** The exact questions this session serves, in order (test_session_questions). */
  questions: Question[];
  /** Answers already given, when an in-progress session is resumed (the daily five). Practice-mode feedback. */
  answers: AnsweredState[];
  /** Answers already stored in a resumed timed session: selected only, never graded. */
  savedAnswers: SavedAnswer[];
};

export type StartSessionResult = ActionError | StartedSession;

export type SessionResult = {
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  score: number;
  startedAt: string;
  completedAt: string;
};

/** Everything the results screen needs, in one round trip: the score and, for every question, the answer key and explanation. */
export type CompleteSessionResult = ActionError | (SessionResult & { questions: Question[]; answers: AnsweredState[] });

export type SessionReviewMeta = {
  sessionId: string;
  mode: TestSessionMode;
  isDaily: boolean;
  focusSubtype: string | null;
  packName: string | null;
  expiresAt: string | null;
};

export type SessionReview = ActionError | (SessionResult & { questions: Question[]; answers: AnsweredState[]; meta: SessionReviewMeta });
