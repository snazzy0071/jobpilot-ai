// Subtype accuracy and weak-area analysis: plain arithmetic over the learner's own answers (the rows come from the
// test_prep_accuracy() SQL function). Pure and deterministic — no AI, nothing invented — so it is unit-tested and so the
// same rule decides "weak" for the progress page, the recommendations and the daily-five selection.

import { MIN_SAMPLE_FOR_WEAK, WEAK_ACCURACY_THRESHOLD } from "@/lib/test-prep/selection";
import type { QuestionDifficulty } from "@/lib/test-prep/types";

export type AccuracyRow = {
  testTypeId: string | null;
  subtype: string;
  difficulty: QuestionDifficulty | null;
  total: number;
  correct: number;
  recentTotal: number;
  recentCorrect: number;
  lastAnsweredAt: string | null;
};

export type Trend = "improving" | "declining" | "steady";

export type TopicAccuracy = {
  testTypeId: string | null;
  subtype: string;
  total: number;
  correct: number;
  /** 0-100 over every answer, or null when there are none. */
  accuracy: number;
  recentTotal: number;
  /** Accuracy over the recent window only, when there are enough answers in it to mean anything. */
  recentAccuracy: number | null;
  /** Recent vs earlier accuracy, only when both halves have enough answers. */
  trend: Trend | null;
  byDifficulty: { difficulty: QuestionDifficulty | "unspecified"; total: number; correct: number; accuracy: number }[];
  lastAnsweredAt: string | null;
};

const MIN_FOR_TREND = 3;
const TREND_MARGIN = 10;

const percent = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : 0);

/** Rolls the (type, subtype, difficulty) rows up to one entry per (type, subtype), keeping the difficulty split. */
export function aggregateTopics(rows: AccuracyRow[]): TopicAccuracy[] {
  const groups = new Map<string, AccuracyRow[]>();
  for (const row of rows) {
    const key = `${row.testTypeId ?? "none"}::${row.subtype}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.values()]
    .map((group) => {
      const total = group.reduce((sum, row) => sum + row.total, 0);
      const correct = group.reduce((sum, row) => sum + row.correct, 0);
      const recentTotal = group.reduce((sum, row) => sum + row.recentTotal, 0);
      const recentCorrect = group.reduce((sum, row) => sum + row.recentCorrect, 0);
      const earlierTotal = total - recentTotal;
      const earlierCorrect = correct - recentCorrect;

      let trend: Trend | null = null;
      if (recentTotal >= MIN_FOR_TREND && earlierTotal >= MIN_FOR_TREND) {
        const change = percent(recentCorrect, recentTotal) - percent(earlierCorrect, earlierTotal);
        trend = change >= TREND_MARGIN ? "improving" : change <= -TREND_MARGIN ? "declining" : "steady";
      }

      const last = group.map((row) => row.lastAnsweredAt).filter((value): value is string => value !== null).sort().at(-1) ?? null;
      return {
        testTypeId: group[0].testTypeId,
        subtype: group[0].subtype,
        total,
        correct,
        accuracy: percent(correct, total),
        recentTotal,
        recentAccuracy: recentTotal >= MIN_FOR_TREND ? percent(recentCorrect, recentTotal) : null,
        trend,
        byDifficulty: group
          .map((row) => ({ difficulty: row.difficulty ?? ("unspecified" as const), total: row.total, correct: row.correct, accuracy: percent(row.correct, row.total) }))
          .sort((a, b) => ["easy", "medium", "hard", "unspecified"].indexOf(a.difficulty) - ["easy", "medium", "hard", "unspecified"].indexOf(b.difficulty)),
        lastAnsweredAt: last,
      };
    })
    .sort((a, b) => a.subtype.localeCompare(b.subtype));
}

/** Topics with enough answers to judge and accuracy under the threshold, weakest first. */
export function findWeakAreas(topics: TopicAccuracy[]): TopicAccuracy[] {
  return topics
    .filter((topic) => topic.total >= MIN_SAMPLE_FOR_WEAK && topic.accuracy < WEAK_ACCURACY_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

/** Accuracy per test type, over all its topics. */
export function accuracyByType(rows: AccuracyRow[]): Map<string, { total: number; correct: number; accuracy: number }> {
  const result = new Map<string, { total: number; correct: number; accuracy: number }>();
  for (const row of rows) {
    if (!row.testTypeId) continue;
    const entry = result.get(row.testTypeId) ?? { total: 0, correct: 0, accuracy: 0 };
    entry.total += row.total;
    entry.correct += row.correct;
    entry.accuracy = percent(entry.correct, entry.total);
    result.set(row.testTypeId, entry);
  }
  return result;
}
