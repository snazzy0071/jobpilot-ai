import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const USER_ID = "11111111-1111-1111-8111-111111111111";
const SESSION_ID = "22222222-2222-2222-8222-222222222222";
const QUESTION_ID = "33333333-3333-3333-8333-333333333333";

async function mockUser() {
  const { requireUser } = await import("@/lib/auth/session");
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: USER_ID });
}

/** submitAnswer's own two lookups (test_sessions, questions) plus the test_answers upsert — a fixed, small set of tables, each independently configurable per test. */
function stubAdminForSubmitAnswer(config: { session: Record<string, unknown> | null; question: Record<string, unknown> | null }) {
  const upserts: unknown[] = [];
  return {
    upserts,
    client: {
      from: (table: string) => {
        const builder: Record<string, (...args: never[]) => unknown> = {};
        builder.select = () => builder;
        builder.eq = () => builder;
        builder.maybeSingle = () => {
          if (table === "test_sessions") return Promise.resolve({ data: config.session, error: null });
          if (table === "questions") return Promise.resolve({ data: config.question, error: null });
          return Promise.resolve({ data: null, error: null });
        };
        builder.upsert = (row: unknown) => {
          upserts.push(row);
          return { then: (onFulfilled: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(onFulfilled) };
        };
        return builder;
      },
    },
  };
}

describe("submitAnswer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grades a correct multiple-choice answer as correct and stores it", async () => {
    await mockUser();
    const { upserts, client } = stubAdminForSubmitAnswer({
      session: { id: SESSION_ID, user_id: USER_ID, question_pack_id: "pack-1", is_daily: false, completed_at: null, expires_at: null },
      question: { id: QUESTION_ID, question_pack_id: "pack-1", question_type: "multiple_choice", is_active: true, correct_answer: "B", explanation: "Because B." },
    });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { submitAnswer } = await import("@/lib/test-prep/practice/actions");
    const result = await submitAnswer({ testSessionId: SESSION_ID, questionId: QUESTION_ID, selectedAnswer: "B" });

    expect(result).toEqual({ questionId: QUESTION_ID, selectedAnswer: "B", isCorrect: true, correctAnswer: "B", explanation: "Because B." });
    expect((upserts[0] as { is_correct: boolean }).is_correct).toBe(true);
  });

  it("grades a wrong answer as incorrect, not just 'not correct'", async () => {
    await mockUser();
    const { client } = stubAdminForSubmitAnswer({
      session: { id: SESSION_ID, user_id: USER_ID, question_pack_id: "pack-1", is_daily: false, completed_at: null, expires_at: null },
      question: { id: QUESTION_ID, question_pack_id: "pack-1", question_type: "multiple_choice", is_active: true, correct_answer: "B", explanation: null },
    });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { submitAnswer } = await import("@/lib/test-prep/practice/actions");
    const result = await submitAnswer({ testSessionId: SESSION_ID, questionId: QUESTION_ID, selectedAnswer: "A" });
    expect(result).toEqual(expect.objectContaining({ isCorrect: false }));
  });

  it("grades a free-text question (no correct_answer at all) as genuinely ungraded, not false", async () => {
    await mockUser();
    const { client } = stubAdminForSubmitAnswer({
      session: { id: SESSION_ID, user_id: USER_ID, question_pack_id: "pack-1", is_daily: false, completed_at: null, expires_at: null },
      question: { id: QUESTION_ID, question_pack_id: "pack-1", question_type: "free_text", is_active: true, correct_answer: null, explanation: null },
    });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { submitAnswer } = await import("@/lib/test-prep/practice/actions");
    const result = await submitAnswer({ testSessionId: SESSION_ID, questionId: QUESTION_ID, selectedAnswer: "Some free text." });
    expect(result).toEqual(expect.objectContaining({ isCorrect: null }));
  });

  it("rejects a submission after the session's own stored expires_at, without grading or storing anything", async () => {
    await mockUser();
    const past = new Date(Date.now() - 60_000).toISOString();
    const { upserts, client } = stubAdminForSubmitAnswer({
      session: { id: SESSION_ID, user_id: USER_ID, question_pack_id: "pack-1", is_daily: false, completed_at: null, expires_at: past },
      question: { id: QUESTION_ID, question_pack_id: "pack-1", question_type: "multiple_choice", is_active: true, correct_answer: "B", explanation: null },
    });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { submitAnswer } = await import("@/lib/test-prep/practice/actions");
    const result = await submitAnswer({ testSessionId: SESSION_ID, questionId: QUESTION_ID, selectedAnswer: "B" });
    expect(result).toEqual({ expired: true });
    expect(upserts).toHaveLength(0);
  });

  it("rejects an answer for a session that's already been completed", async () => {
    await mockUser();
    const { client } = stubAdminForSubmitAnswer({
      session: { id: SESSION_ID, user_id: USER_ID, question_pack_id: "pack-1", is_daily: false, completed_at: "2024-01-01T00:00:00.000Z", expires_at: null },
      question: { id: QUESTION_ID, question_pack_id: "pack-1", question_type: "multiple_choice", is_active: true, correct_answer: "B", explanation: null },
    });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { submitAnswer } = await import("@/lib/test-prep/practice/actions");
    const result = await submitAnswer({ testSessionId: SESSION_ID, questionId: QUESTION_ID, selectedAnswer: "B" });
    expect(result).toEqual({ error: "This practice session has already finished." });
  });

  it("rejects a question that doesn't belong to this session's own pack", async () => {
    await mockUser();
    const { client } = stubAdminForSubmitAnswer({
      session: { id: SESSION_ID, user_id: USER_ID, question_pack_id: "pack-1", is_daily: false, completed_at: null, expires_at: null },
      question: { id: QUESTION_ID, question_pack_id: "a-totally-different-pack", question_type: "multiple_choice", is_active: true, correct_answer: "B", explanation: null },
    });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { submitAnswer } = await import("@/lib/test-prep/practice/actions");
    const result = await submitAnswer({ testSessionId: SESSION_ID, questionId: QUESTION_ID, selectedAnswer: "B" });
    expect(result).toEqual({ error: "That question doesn't belong to this session." });
  });

  it("accepts any active question for a daily (is_daily) session, which has no single pack to check against", async () => {
    await mockUser();
    const { upserts, client } = stubAdminForSubmitAnswer({
      session: { id: SESSION_ID, user_id: USER_ID, question_pack_id: null, is_daily: true, completed_at: null, expires_at: null },
      question: { id: QUESTION_ID, question_pack_id: "any-pack-at-all", question_type: "multiple_choice", is_active: true, correct_answer: "A", explanation: null },
    });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { submitAnswer } = await import("@/lib/test-prep/practice/actions");
    const result = await submitAnswer({ testSessionId: SESSION_ID, questionId: QUESTION_ID, selectedAnswer: "A" });
    expect(result).toEqual(expect.objectContaining({ isCorrect: true }));
    expect(upserts).toHaveLength(1);
  });

  it("rejects a session that doesn't belong to the requesting user, even if the id is otherwise valid", async () => {
    await mockUser();
    const { client } = stubAdminForSubmitAnswer({
      session: { id: SESSION_ID, user_id: "someone-else", question_pack_id: "pack-1", is_daily: false, completed_at: null, expires_at: null },
      question: { id: QUESTION_ID, question_pack_id: "pack-1", question_type: "multiple_choice", is_active: true, correct_answer: "B", explanation: null },
    });
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);

    const { submitAnswer } = await import("@/lib/test-prep/practice/actions");
    const result = await submitAnswer({ testSessionId: SESSION_ID, questionId: QUESTION_ID, selectedAnswer: "B" });
    expect(result).toEqual({ error: "That practice session couldn't be found." });
  });
});

/** completeTestSession's own table sequence: test_sessions (read, then update), test_answers (two counts), question_packs, practice_progress. */
function stubClientForCompleteSession(config: {
  session: Record<string, unknown> | null;
  answeredCount: number;
  correctCount: number;
  pack?: Record<string, unknown> | null;
  existingProgress?: Record<string, unknown> | null;
}) {
  const updates: Record<string, unknown>[] = [];
  const upserts: Record<string, unknown>[] = [];
  const client = {
    from: (table: string) => {
      const builder: Record<string, (...args: never[]) => unknown> = {};
      let countFilterIsCorrect = false;
      builder.select = () => builder;
      builder.eq = (...args: unknown[]) => {
        if (args[0] === "is_correct" && args[1] === true) countFilterIsCorrect = true;
        return builder;
      };
      builder.maybeSingle = () => {
        if (table === "test_sessions") return Promise.resolve({ data: config.session, error: null });
        if (table === "question_packs") return Promise.resolve({ data: config.pack ?? null, error: null });
        if (table === "practice_progress") return Promise.resolve({ data: config.existingProgress ?? null, error: null });
        return Promise.resolve({ data: null, error: null });
      };
      builder.update = (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { eq: () => ({ then: (onFulfilled: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(onFulfilled) }) };
      };
      builder.upsert = (payload: Record<string, unknown>) => {
        upserts.push(payload);
        return { then: (onFulfilled: (v: { error: null }) => unknown) => Promise.resolve({ error: null }).then(onFulfilled) };
      };
      builder.then = (onFulfilled: (v: { count: number; error: null }) => unknown) => {
        if (table === "test_answers") {
          const count = countFilterIsCorrect ? config.correctCount : config.answeredCount;
          return Promise.resolve({ count, error: null }).then(onFulfilled);
        }
        return Promise.resolve({ count: 0, error: null }).then(onFulfilled);
      };
      return builder;
    },
  };
  return { client, updates, upserts };
}

describe("completeTestSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scores correct-count divided by the session's own total_questions snapshot, not answered count", async () => {
    await mockUser();
    // 3 correct out of 5 total questions, but only 4 were actually
    // answered — the un-answered one still counts against the score.
    const { client, updates } = stubClientForCompleteSession({
      session: { id: SESSION_ID, question_pack_id: null, total_questions: 5, correct_count: null, score: null, started_at: "2024-01-01T00:00:00.000Z", completed_at: null },
      answeredCount: 4,
      correctCount: 3,
    });
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const { completeTestSession } = await import("@/lib/test-prep/practice/actions");
    const result = await completeTestSession({ testSessionId: SESSION_ID });

    if ("error" in result) throw new Error("expected a real result");
    expect(result.score).toBe(60); // round(3/5 * 100)
    expect(result.answeredCount).toBe(4);
    expect(result.correctCount).toBe(3);
    expect(updates[0]).toMatchObject({ correct_count: 3, score: 60 });
  });

  it("is idempotent: an already-completed session returns its real stored result instead of recomputing", async () => {
    await mockUser();
    const { client, updates } = stubClientForCompleteSession({
      session: {
        id: SESSION_ID,
        question_pack_id: null,
        total_questions: 5,
        correct_count: 4,
        score: 80,
        started_at: "2024-01-01T00:00:00.000Z",
        completed_at: "2024-01-01T00:10:00.000Z",
      },
      answeredCount: 5,
      correctCount: 999, // deliberately wrong — if this were used, the test would wrongly pass a different score
    });
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const { completeTestSession } = await import("@/lib/test-prep/practice/actions");
    const result = await completeTestSession({ testSessionId: SESSION_ID });

    if ("error" in result) throw new Error("expected a real result");
    expect(result.score).toBe(80); // the real stored score, not recomputed from correctCount above
    expect(updates).toHaveLength(0); // never re-wrote anything
  });

  it("rolls the result into practice_progress: increments attempts and keeps the real best score", async () => {
    await mockUser();
    const { client, upserts } = stubClientForCompleteSession({
      session: { id: SESSION_ID, question_pack_id: "pack-1", total_questions: 4, correct_count: null, score: null, started_at: "2024-01-01T00:00:00.000Z", completed_at: null },
      answeredCount: 4,
      correctCount: 4,
      pack: { test_type_id: "type-1" },
      existingProgress: { attempts_count: 2, best_score: 90 }, // higher than this attempt's 100 is impossible here, but a *lower* prior best must not overwrite a higher new score — see next test
    });
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const { completeTestSession } = await import("@/lib/test-prep/practice/actions");
    await completeTestSession({ testSessionId: SESSION_ID });

    expect(upserts[0]).toMatchObject({ attempts_count: 3, best_score: 100, test_type_id: "type-1" });
  });

  it("keeps the higher of the existing best_score and this attempt's score, never regressing it", async () => {
    await mockUser();
    const { client, upserts } = stubClientForCompleteSession({
      session: { id: SESSION_ID, question_pack_id: "pack-1", total_questions: 4, correct_count: null, score: null, started_at: "2024-01-01T00:00:00.000Z", completed_at: null },
      answeredCount: 1,
      correctCount: 0, // this attempt scores 0
      pack: { test_type_id: "type-1" },
      existingProgress: { attempts_count: 5, best_score: 85 },
    });
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const { completeTestSession } = await import("@/lib/test-prep/practice/actions");
    await completeTestSession({ testSessionId: SESSION_ID });

    expect(upserts[0]).toMatchObject({ attempts_count: 6, best_score: 85 }); // kept, not dropped to 0
  });

  it("skips the practice_progress rollup entirely for a daily session (no question_pack_id)", async () => {
    await mockUser();
    const { client, upserts } = stubClientForCompleteSession({
      session: { id: SESSION_ID, question_pack_id: null, total_questions: 5, correct_count: null, score: null, started_at: "2024-01-01T00:00:00.000Z", completed_at: null },
      answeredCount: 5,
      correctCount: 5,
    });
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const { completeTestSession } = await import("@/lib/test-prep/practice/actions");
    await completeTestSession({ testSessionId: SESSION_ID });

    expect(upserts).toHaveLength(0);
  });
});
