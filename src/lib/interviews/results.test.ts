import { describe, expect, it } from "vitest";
import { computeCompetencyBreakdown, getWeakCompetencies } from "@/lib/interviews/results";
import type { InterviewQuestion, InterviewAnswerScore } from "@/lib/interviews/types";

function question(overrides: Partial<InterviewQuestion> = {}): InterviewQuestion {
  return { id: "q1", competency: "leadership", question: "Tell me about a time...", displayOrder: 0, ...overrides };
}

function score(overallScore: number, overrides: Partial<InterviewAnswerScore> = {}): InterviewAnswerScore {
  return {
    situationScore: overallScore,
    taskScore: overallScore,
    actionScore: overallScore,
    resultScore: overallScore,
    relevanceScore: overallScore,
    clarityScore: overallScore,
    evidenceScore: overallScore,
    overallScore,
    strengths: [],
    improvements: [],
    suggestedRephrase: null,
    ...overrides,
  };
}

describe("computeCompetencyBreakdown", () => {
  it("returns nothing for a question that has no score yet", () => {
    const breakdown = computeCompetencyBreakdown([question({ id: "q1" })], {});
    expect(breakdown).toEqual([]);
  });

  it("averages a competency's per-question overallScore when it comes up more than once", () => {
    const questions = [
      question({ id: "q1", competency: "teamwork" }),
      question({ id: "q2", competency: "teamwork" }),
    ];
    const scores = { q1: score(60), q2: score(80) };
    const breakdown = computeCompetencyBreakdown(questions, scores);
    expect(breakdown).toEqual([{ competency: "teamwork", score: 70 }]);
  });

  it("keeps distinct competencies as separate entries", () => {
    const questions = [
      question({ id: "q1", competency: "leadership" }),
      question({ id: "q2", competency: "communication" }),
    ];
    const scores = { q1: score(50), q2: score(90) };
    const breakdown = computeCompetencyBreakdown(questions, scores);
    expect(breakdown).toHaveLength(2);
    expect(breakdown).toContainEqual({ competency: "leadership", score: 50 });
    expect(breakdown).toContainEqual({ competency: "communication", score: 90 });
  });

  it("skips a scored question with no matching entry in `scores`, without crashing", () => {
    const questions = [question({ id: "q1" }), question({ id: "q2", competency: "resilience" })];
    const scores = { q2: score(75) }; // q1 never answered/scored
    const breakdown = computeCompetencyBreakdown(questions, scores);
    expect(breakdown).toEqual([{ competency: "resilience", score: 75 }]);
  });

  it("rounds a non-whole average to the nearest integer", () => {
    const questions = [
      question({ id: "q1", competency: "initiative" }),
      question({ id: "q2", competency: "initiative" }),
      question({ id: "q3", competency: "initiative" }),
    ];
    const scores = { q1: score(70), q2: score(71), q3: score(71) };
    const breakdown = computeCompetencyBreakdown(questions, scores);
    // (70+71+71)/3 = 70.666... -> rounds to 71
    expect(breakdown).toEqual([{ competency: "initiative", score: 71 }]);
  });
});

describe("getWeakCompetencies", () => {
  it("returns nothing when every competency is at or above the threshold", () => {
    const weak = getWeakCompetencies([
      { competency: "leadership", score: 70 },
      { competency: "teamwork", score: 95 },
    ]);
    expect(weak).toEqual([]);
  });

  it("includes a competency strictly below the threshold, weakest first", () => {
    const weak = getWeakCompetencies([
      { competency: "leadership", score: 40 },
      { competency: "teamwork", score: 65 },
      { competency: "communication", score: 90 },
    ]);
    expect(weak).toEqual(["leadership", "teamwork"]);
  });

  it("treats a score exactly at the threshold as not weak (strictly less-than)", () => {
    const weak = getWeakCompetencies([{ competency: "resilience", score: 70 }]);
    expect(weak).toEqual([]);
  });
});
