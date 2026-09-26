import { describe, expect, it } from "vitest";
import { accuracyByType, aggregateTopics, findWeakAreas, type AccuracyRow } from "@/lib/test-prep/accuracy";

const row = (over: Partial<AccuracyRow>): AccuracyRow => ({
  testTypeId: "t1",
  subtype: "Percentages",
  difficulty: "easy",
  total: 0,
  correct: 0,
  recentTotal: 0,
  recentCorrect: 0,
  lastAnsweredAt: null,
  ...over,
});

describe("aggregateTopics", () => {
  it("rolls difficulty rows up to one topic with a difficulty split", () => {
    const [topic] = aggregateTopics([
      row({ difficulty: "hard", total: 4, correct: 1, lastAnsweredAt: "2026-02-02T00:00:00Z" }),
      row({ difficulty: "easy", total: 6, correct: 6, lastAnsweredAt: "2026-02-05T00:00:00Z" }),
    ]);
    expect(topic.total).toBe(10);
    expect(topic.correct).toBe(7);
    expect(topic.accuracy).toBe(70);
    expect(topic.byDifficulty.map((d) => d.difficulty)).toEqual(["easy", "hard"]);
    expect(topic.lastAnsweredAt).toBe("2026-02-05T00:00:00Z");
  });

  it("keeps the same topic in different test types separate", () => {
    const topics = aggregateTopics([row({ testTypeId: "a", total: 1, correct: 1 }), row({ testTypeId: "b", total: 1, correct: 0 })]);
    expect(topics).toHaveLength(2);
  });

  it("calls a trend only when both halves have enough answers", () => {
    const [few] = aggregateTopics([row({ total: 4, correct: 2, recentTotal: 2, recentCorrect: 2 })]);
    expect(few.trend).toBeNull();
    expect(few.recentAccuracy).toBeNull();
  });

  it("detects improving, declining and steady trends", () => {
    // earlier: 2/5 = 40%; recent: 4/5 = 80%
    const [up] = aggregateTopics([row({ total: 10, correct: 6, recentTotal: 5, recentCorrect: 4 })]);
    expect(up.trend).toBe("improving");
    // earlier: 4/5 = 80%; recent: 1/5 = 20%
    const [down] = aggregateTopics([row({ total: 10, correct: 5, recentTotal: 5, recentCorrect: 1 })]);
    expect(down.trend).toBe("declining");
    // earlier 3/5 = 60%; recent 3/5 = 60%
    const [flat] = aggregateTopics([row({ total: 10, correct: 6, recentTotal: 5, recentCorrect: 3 })]);
    expect(flat.trend).toBe("steady");
  });

  it("returns nothing for no rows", () => {
    expect(aggregateTopics([])).toEqual([]);
  });
});

describe("findWeakAreas", () => {
  it("needs enough answers and accuracy under 70%, weakest first", () => {
    const topics = aggregateTopics([
      row({ subtype: "Ratios", total: 10, correct: 3 }),
      row({ subtype: "Averages", total: 10, correct: 6 }),
      row({ subtype: "Fractions", total: 10, correct: 9 }),
      row({ subtype: "Tiny sample", total: 2, correct: 0 }),
      row({ subtype: "Exactly at threshold", total: 10, correct: 7 }),
    ]);
    expect(findWeakAreas(topics).map((t) => t.subtype)).toEqual(["Ratios", "Averages"]);
  });
});

describe("accuracyByType", () => {
  it("sums by test type and skips rows with no type", () => {
    const result = accuracyByType([row({ testTypeId: "a", total: 4, correct: 3 }), row({ testTypeId: "a", subtype: "X", total: 4, correct: 1 }), row({ testTypeId: null, total: 9, correct: 9 })]);
    expect(result.get("a")).toEqual({ total: 8, correct: 4, accuracy: 50 });
    expect(result.size).toBe(1);
  });
});
