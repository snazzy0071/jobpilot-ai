import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/ai/gateway", () => ({ generateStructuredGated: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/interviews/queries", () => ({ getTranscriptTurns: vi.fn(), getSessionScores: vi.fn() }));
vi.mock("@/lib/interviews/internal", () => ({
  getSessionForChat: vi.fn(),
  nextSequenceIndex: vi.fn(),
  insertTranscriptTurn: vi.fn(),
  countPrimaryQuestions: vi.fn(),
  getFollowUpState: vi.fn(),
  appendAnswer: vi.fn(),
  completeSession: vi.fn(),
  getAnswer: vi.fn(),
  persistAnswerScore: vi.fn(),
  persistSessionSummary: vi.fn(),
}));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";

const SESSION = {
  role: "Engineer",
  company: "Acme",
  jobDescription: null,
  difficulty: "medium",
  cvTextSnapshot: "CV text",
  mode: "chat",
  status: "in_progress",
  startedAt: new Date().toISOString(),
  focusCompetencies: [],
};

async function setup() {
  const { requireUser } = await import("@/lib/auth/session");
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-1" });

  const { createClient } = await import("@/lib/supabase/server");
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => Promise.resolve({ data: { question: "Tell me about a time you led a team." }, error: null });
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({ from: () => builder });

  const internal = await import("@/lib/interviews/internal");
  (internal.getSessionForChat as ReturnType<typeof vi.fn>).mockResolvedValue(SESSION);
  (internal.nextSequenceIndex as ReturnType<typeof vi.fn>).mockResolvedValue(1);
  (internal.countPrimaryQuestions as ReturnType<typeof vi.fn>).mockResolvedValue(2);
  (internal.getFollowUpState as ReturnType<typeof vi.fn>).mockResolvedValue({ followUpCount: 0, mustAdvance: false });
  (internal.insertTranscriptTurn as ReturnType<typeof vi.fn>).mockImplementation(async (_supabase, params) => ({
    id: `turn-${params.sequenceIndex}`,
    content: params.content,
    questionId: params.questionId,
    sequenceIndex: params.sequenceIndex,
  }));

  const queries = await import("@/lib/interviews/queries");
  (queries.getTranscriptTurns as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: "t0", speaker: "interviewer", content: "Tell me about a time you led a team.", questionId: "q1", sequenceIndex: 0 },
  ]);

  return { internal };
}

describe("submitInterviewAnswer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists nothing when the interviewer's next move fails, so a retry can't duplicate the reply", async () => {
    const { internal } = await setup();
    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    const { AIServiceError } = await import("@/lib/ai/errors");
    (generateStructuredGated as ReturnType<typeof vi.fn>).mockRejectedValue(
      new AIServiceError("You're sending requests too quickly — wait a moment and try again.", "rate_limited"),
    );

    const { submitInterviewAnswer } = await import("@/lib/interviews/chat-actions");
    const result = await submitInterviewAnswer(SESSION_ID, "My answer");

    expect(result).toEqual({ error: "You're sending requests too quickly — wait a moment and try again." });
    expect(internal.insertTranscriptTurn).not.toHaveBeenCalled();
    expect(internal.appendAnswer).not.toHaveBeenCalled();
  });

  it("saves the reply exactly once, before the interviewer's follow-up, when the turn succeeds", async () => {
    const { internal } = await setup();
    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    (generateStructuredGated as ReturnType<typeof vi.fn>).mockResolvedValue({ action: "follow_up", message: "Can you say more about the result?" });

    const { submitInterviewAnswer } = await import("@/lib/interviews/chat-actions");
    const result = await submitInterviewAnswer(SESSION_ID, "My answer");

    expect(internal.appendAnswer).toHaveBeenCalledTimes(1);
    const inserts = (internal.insertTranscriptTurn as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[1]);
    expect(inserts.map((insert) => [insert.speaker, insert.sequenceIndex])).toEqual([
      ["candidate", 1],
      ["interviewer", 2],
    ]);
    expect(result).toMatchObject({ status: "in_progress" });
  });
});
