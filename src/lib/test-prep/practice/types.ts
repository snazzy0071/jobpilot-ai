// Types for the practice-taking flow (src/lib/test-prep/practice/
// actions.ts) — distinct from src/lib/test-prep/types.ts's own
// `Question`/`TestSession`/`TestAnswer`, which describe the *stored*
// shape. These describe what a Server Action actually hands back to
// the client at each step.

/** `expiresAt` is the server's own deadline snapshot (migration 0070) — the client seeds its countdown display from this, never from the pack's own `timeLimitSeconds` prop, so the displayed clock can't drift from what the server will actually enforce. */
export type StartSessionResult = { error: string } | { sessionId: string; totalQuestions: number; expiresAt: string | null };

/**
 * The one place `correctAnswer`/`explanation` are ever sent to the
 * client for a specific question — and only *after* that question has
 * actually been answered (submitAnswer grades it server-side, through
 * the service-role client, before this is built — see that function's
 * own comment). The practice engine accumulates one of these per
 * answered question in local state; that's also what the results
 * screen replays, so completing a session never needs a second
 * privileged fetch of the same data.
 *
 * `{ expired: true }` is the third, distinct outcome: the session's own
 * `expires_at` (set once at start, never client-supplied) had already
 * passed when this submission arrived, so nothing was graded or stored
 * — a late answer is rejected outright, not silently accepted. The
 * client's only correct reaction is to finish the session immediately.
 */
export type SubmitAnswerResult =
  | { error: string }
  | { expired: true }
  | {
      questionId: string;
      selectedAnswer: string | null;
      isCorrect: boolean | null;
      correctAnswer: string | null;
      explanation: string | null;
    };

/** The one graded-and-stored shape of `SubmitAnswerResult` — what the practice engine actually keeps, one per answered question, keyed by `questionId`. Shared with `src/lib/test-prep/practice/summary.ts`, which is what turns a map of these into a session summary. */
export type AnsweredState = Extract<SubmitAnswerResult, { questionId: string }>;

/**
 * `startedAt`/`completedAt` are both real server timestamps (the
 * former stored once at `startTestSession`, migration 0070's own
 * `started_at`; the latter set the moment this session actually
 * finished) — the session-summary screen derives duration from these
 * rather than anything client-clocked, same "server is the timing
 * authority" reasoning `expires_at` already established. Everything
 * else in the summary (accuracy, subtype breakdown, wrong-answer
 * explanations, recommended retry areas) is derived client-side from
 * data the practice engine already holds in full — the pack's own
 * `questions` (subtype/difficulty) plus the `answers` map it
 * accumulated during the session (correctness/explanations) — so this
 * result never needs to duplicate that with a second privileged fetch.
 */
export type CompleteSessionResult =
  | { error: string }
  | {
      correctCount: number;
      answeredCount: number;
      totalQuestions: number;
      score: number;
      startedAt: string;
      completedAt: string;
    };
