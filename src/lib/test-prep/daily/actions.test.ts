import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/test-prep/queries", () => ({ listActiveQuestionsAcrossAllPacks: vi.fn() }));

type CompletionRow = { local_date: string; correct_count: number; total_questions: number };

function stubCompletions(rows: CompletionRow[]) {
  const builder: Record<string, (...args: never[]) => unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.order = chain;
  builder.then = (onFulfilled: (v: { data: CompletionRow[]; error: null }) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(onFulfilled);
  return { from: () => builder };
}

function stubError(message: string) {
  const builder: Record<string, (...args: never[]) => unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.order = chain;
  builder.then = (onFulfilled: (v: { data: null; error: { message: string } }) => unknown) =>
    Promise.resolve({ data: null, error: { message } }).then(onFulfilled);
  return { from: () => builder };
}

async function setup(rows: CompletionRow[] | { error: string }) {
  const { requireUser } = await import("@/lib/auth/session");
  (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-1" });
  const { createClient } = await import("@/lib/supabase/server");
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
    Array.isArray(rows) ? stubCompletions(rows) : stubError(rows.error),
  );
}

function completion(localDate: string): CompletionRow {
  return { local_date: localDate, correct_count: 4, total_questions: 5 };
}

describe("getDailyPracticeStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // A Wednesday, comfortably mid-month so `-i` day shifts never cross
    // into a different month/year and complicate the fixture dates.
    vi.setSystemTime(new Date("2024-06-19T09:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports no streak and not completed today when there's no history at all", async () => {
    await setup([]);
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "UTC" });
    expect(result).toEqual(expect.objectContaining({ completedToday: false, currentStreak: 0 }));
  });

  it("counts today alone as a streak of 1 once today is completed", async () => {
    await setup([completion("2024-06-19")]);
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "UTC" });
    expect(result).toEqual(expect.objectContaining({ completedToday: true, currentStreak: 1 }));
  });

  it("counts a run of consecutive days ending today", async () => {
    await setup([completion("2024-06-19"), completion("2024-06-18"), completion("2024-06-17"), completion("2024-06-16")]);
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "UTC" });
    expect(result).toEqual(expect.objectContaining({ completedToday: true, currentStreak: 4 }));
  });

  it("keeps a streak alive from yesterday when today hasn't been completed yet", async () => {
    await setup([completion("2024-06-18"), completion("2024-06-17")]);
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "UTC" });
    expect(result).toEqual(expect.objectContaining({ completedToday: false, currentStreak: 2 }));
  });

  it("resets the streak to 0 once a day is completely missed, even with older completions further back", async () => {
    // Today done, yesterday missing, day-before-yesterday done — the gap
    // at yesterday must stop the walk immediately after today.
    await setup([completion("2024-06-19"), completion("2024-06-17")]);
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "UTC" });
    expect(result).toEqual(expect.objectContaining({ completedToday: true, currentStreak: 1 }));
  });

  it("resets to 0 (not counted from yesterday) when neither today nor yesterday was completed", async () => {
    await setup([completion("2024-06-10")]);
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "UTC" });
    expect(result).toEqual(expect.objectContaining({ completedToday: false, currentStreak: 0 }));
  });

  it("returns exactly 14 days, oldest first, ending on today, with per-day completion detail", async () => {
    await setup([completion("2024-06-19")]);
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "UTC" });
    if ("error" in result) throw new Error("expected a real status");
    expect(result.last14Days).toHaveLength(14);
    expect(result.last14Days[13].date).toBe("2024-06-19");
    expect(result.last14Days[0].date).toBe("2024-06-06");
    const today = result.last14Days[13];
    expect(today).toEqual({ date: "2024-06-19", completed: true, correctCount: 4, totalQuestions: 5 });
    const untouchedDay = result.last14Days[0];
    expect(untouchedDay).toEqual({ date: "2024-06-06", completed: false, correctCount: null, totalQuestions: null });
  });

  it("rejects an invalid IANA timezone rather than crashing on the Intl call", async () => {
    await setup([]);
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "Not/A_Real_Zone" });
    expect(result).toEqual({ error: "Invalid request." });
  });

  it("fails closed with a friendly error when the completions query itself errors", async () => {
    await setup({ error: "connection reset" });
    const { getDailyPracticeStatus } = await import("@/lib/test-prep/daily/actions");
    const result = await getDailyPracticeStatus({ timezone: "UTC" });
    expect(result).toEqual({ error: "Couldn't load your practice streak — try again." });
  });
});
