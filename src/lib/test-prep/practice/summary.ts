// Pure, client-safe derivation of a finished session's summary — no
// Supabase call of its own. Everything it needs is already in the
// practice engine's own memory by the time a session completes: the
// pack's `questions` (subtype/difficulty are public columns, safe to
// hold client-side) and the `answers` map it accumulated one
// `submitAnswer` result at a time during the session (which is also
// the only place `correctAnswer`/`explanation` ever reach the client —
// see AnsweredState's own comment). Recomputing this from a second,
// privileged fetch would just duplicate data the component already
// has correctly.

import type { Question } from "@/lib/test-prep/types";
import type { AnsweredState, CompleteSessionResult } from "@/lib/test-prep/practice/types";

type CompletedSession = Extract<CompleteSessionResult, { score: number }>;

export type SubtypeBreakdown = {
  subtype: string;
  total: number;
  answered: number;
  correct: number;
  /** 0-100, rounded; over `answered`, not `total` — an unattempted question is what makes this subtype a retry candidate, not what tanks its accuracy. */
  accuracy: number;
};

export type WrongAnswer = {
  questionId: string;
  prompt: string;
  subtype: string | null;
  selectedAnswer: string | null;
  correctAnswer: string | null;
  explanation: string | null;
};

export type SessionSummaryStats = {
  score: number;
  /** correct ÷ answered (0-100) — distinct from `score`, which is correct ÷ the full `totalQuestions` snapshot and so also counts a skipped question against you. */
  accuracy: number;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  durationSeconds: number;
  averageSecondsPerQuestion: number;
  subtypeBreakdown: SubtypeBreakdown[];
  /** Subtypes with any unanswered question or sub-threshold accuracy, worst-first. */
  recommendedRetrySubtypes: string[];
  wrongAnswers: WrongAnswer[];
};

const UNTAGGED_SUBTYPE = "General";
const RETRY_ACCURACY_THRESHOLD = 80;

export function buildSessionSummary(
  questions: Question[],
  answers: Map<string, AnsweredState>,
  result: CompletedSession,
): SessionSummaryStats {
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000),
  );
  const averageSecondsPerQuestion = result.totalQuestions > 0 ? Math.round(durationSeconds / result.totalQuestions) : 0;
  const accuracy = result.answeredCount > 0 ? Math.round((result.correctCount / result.answeredCount) * 100) : 0;

  const bySubtype = new Map<string, { total: number; answered: number; correct: number }>();
  for (const question of questions) {
    const key = question.subtype ?? UNTAGGED_SUBTYPE;
    const bucket = bySubtype.get(key) ?? { total: 0, answered: 0, correct: 0 };
    bucket.total += 1;
    const answer = answers.get(question.id);
    if (answer) {
      bucket.answered += 1;
      if (answer.isCorrect) bucket.correct += 1;
    }
    bySubtype.set(key, bucket);
  }

  const subtypeBreakdown: SubtypeBreakdown[] = Array.from(bySubtype.entries())
    .map(([subtype, bucket]) => ({
      subtype,
      total: bucket.total,
      answered: bucket.answered,
      correct: bucket.correct,
      accuracy: bucket.answered > 0 ? Math.round((bucket.correct / bucket.answered) * 100) : 0,
    }))
    .sort((a, b) => a.subtype.localeCompare(b.subtype));

  const recommendedRetrySubtypes = subtypeBreakdown
    .filter((entry) => entry.answered < entry.total || entry.accuracy < RETRY_ACCURACY_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((entry) => entry.subtype);

  const wrongAnswers: WrongAnswer[] = [];
  for (const question of questions) {
    const answer = answers.get(question.id);
    if (answer?.isCorrect !== false) continue;
    wrongAnswers.push({
      questionId: question.id,
      prompt: question.prompt,
      subtype: question.subtype,
      selectedAnswer: answer.selectedAnswer,
      correctAnswer: answer.correctAnswer,
      explanation: answer.explanation,
    });
  }

  return {
    score: result.score,
    accuracy,
    correctCount: result.correctCount,
    answeredCount: result.answeredCount,
    totalQuestions: result.totalQuestions,
    durationSeconds,
    averageSecondsPerQuestion,
    subtypeBreakdown,
    recommendedRetrySubtypes,
    wrongAnswers,
  };
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
