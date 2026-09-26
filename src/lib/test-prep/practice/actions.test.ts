import { beforeEach, describe, expect, it, vi } from "vitest";

// Plan gating is enforced inside every Test Prep action. When the plan doesn't include it, the action must answer
// "locked" without ever touching the database — so the clients below throw if anything asks for them.

const gateTestPrep = vi.fn();
const createClient = vi.fn(() => {
  throw new Error("database touched while locked");
});
const createAdminClient = vi.fn(() => {
  throw new Error("admin database touched while locked");
});

vi.mock("@/lib/auth/session", () => ({ requireUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/test-prep/access", () => ({ gateTestPrep: (...args: unknown[]) => gateTestPrep(...args) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => createClient() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => createAdminClient() }));

import { completeTestSession, getSessionReview, startFocusedPractice, startTestSession, submitAnswer } from "@/lib/test-prep/practice/actions";
import { getDailyPracticeStatus, recordDailyCompletion, startDailyPractice } from "@/lib/test-prep/daily/actions";

const ID = "3f0c1f9e-6f2e-4b7e-9a51-0f3a5d6b7c8d";
const LOCKED = { error: "Test Prep is part of Premium and Elite.", locked: true as const };

describe("plan gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateTestPrep.mockResolvedValue(LOCKED);
  });

  it("refuses every practice action without touching the database", async () => {
    const results = await Promise.all([
      startTestSession({ questionPackId: ID, mode: "practice" }),
      startFocusedPractice({ testTypeId: ID, subtype: "Percentages" }),
      submitAnswer({ testSessionId: ID, questionId: ID, selectedAnswer: "a" }),
      completeTestSession({ testSessionId: ID }),
      getSessionReview({ testSessionId: ID }),
    ]);
    for (const result of results) expect(result).toEqual(LOCKED);
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("refuses every daily-five action without touching the database", async () => {
    const results = await Promise.all([
      getDailyPracticeStatus({ timezone: "Europe/London" }),
      startDailyPractice({ timezone: "Europe/London" }),
      recordDailyCompletion({ testSessionId: ID, timezone: "Europe/London" }),
    ]);
    for (const result of results) expect(result).toEqual(LOCKED);
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("input validation (when the plan allows it)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateTestPrep.mockResolvedValue(null);
  });

  it("rejects malformed ids before any query", async () => {
    expect(await startTestSession({ questionPackId: "nope", mode: "practice" })).toEqual({ error: "Invalid request." });
    expect(await submitAnswer({ testSessionId: "nope", questionId: ID, selectedAnswer: "a" })).toEqual({ error: "Invalid request." });
    expect(await completeTestSession({ testSessionId: "nope" })).toEqual({ error: "Invalid request." });
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an unknown mode", async () => {
    // @ts-expect-error — deliberately invalid
    expect(await startTestSession({ questionPackId: ID, mode: "exam" })).toEqual({ error: "Invalid request." });
  });
});
