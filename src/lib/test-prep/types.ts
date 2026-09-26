// Canonical source for the test-prep domain — mirrors migration 0067's
// real Postgres shape (public.test_types / question_packs / questions /
// test_sessions / test_answers / practice_progress). See that
// migration's own header comment for the column-level privilege
// protecting `correct_answer`/`explanation` from ever being fetched by
// a practice-taker before answering — this file's own `Question` type
// deliberately doesn't include either field for that same reason (a
// query using the anon-respecting client can't select them regardless,
// so a type that promised them would be a lie).

import type { Exhibit, FigureCell } from "@/lib/test-prep/exhibit";

export const QUESTION_TYPES = ["multiple_choice", "true_false", "free_text"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// Matches migration 0069's public.question_difficulty exactly.
export const QUESTION_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export type TestType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type QuestionPack = {
  id: string;
  testTypeId: string;
  slug: string;
  name: string;
  description: string | null;
  /** A free-text theme label ("Consulting", "Investment Banking", …) — the employer *style* a pack is written for, never a real publisher's or firm's own branded test name (migration 0068's own comment covers why this is plain text, not an enum). */
  sectorStyle: string | null;
  timeLimitSeconds: number | null;
  isActive: boolean;
};

/**
 * A question as a practice-taker is allowed to see it — no
 * `correctAnswer`/`explanation`, matching migration 0067's column-level
 * grant exactly. Grading a submitted answer has to happen server-side,
 * through the service-role client (the only thing that can read those
 * two columns), never by comparing against a value sent to the client.
 */
export type Question = {
  id: string;
  questionPackId: string;
  questionType: QuestionType;
  /** The passage / scenario the question is about, shown above the prompt. */
  stimulus: string | null;
  prompt: string;
  options: string[];
  /** A table, bar chart or shape figure the question is about (numerical and diagrammatic reasoning). */
  exhibit: Exhibit | null;
  /** One picture per option, for diagrammatic answers (the option text is then just its label). */
  optionFigures: FigureCell[] | null;
  /** Both nullable — not every question is tagged (migration 0069's own comment covers why difficulty is an enum and subtype is free text). Neither is sensitive; both are in the same public column grant as prompt/options. */
  difficulty: QuestionDifficulty | null;
  subtype: string | null;
  displayOrder: number;
  isActive: boolean;
};

export type TestSessionMode = "practice" | "timed";

export type TestSession = {
  id: string;
  questionPackId: string | null;
  mode: TestSessionMode;
  totalQuestions: number;
  correctCount: number | null;
  score: number | null;
  startedAt: string;
  /** Server-computed deadline snapshot (migration 0070) — null for untimed packs. */
  expiresAt: string | null;
  completedAt: string | null;
};

export type TestAnswer = {
  id: string;
  testSessionId: string;
  questionId: string | null;
  selectedAnswer: string | null;
  isCorrect: boolean | null;
  answeredAt: string;
};

/** One public.practice_progress row — the per-(user, test_type) rollup a learner actually wants to see, above the level of one pack/attempt. */
export type PracticeProgress = {
  id: string;
  testTypeId: string;
  attemptsCount: number;
  bestScore: number | null;
  lastPracticedAt: string | null;
};
