import { describe, expect, it } from "vitest";
import { createQuestionSchema, importQuestionsSchema, parseImportedQuestions } from "@/lib/test-prep/admin/schemas";

const PACK = "3f0c1f9e-6f2e-4b7e-9a51-0f3a5d6b7c8d";

function form(over: Record<string, string | undefined> = {}) {
  return {
    questionPackId: PACK,
    questionType: "multiple_choice",
    prompt: "What is 10% of 250?",
    options: "20\n25\n30",
    correctAnswer: "25",
    ...over,
  };
}

describe("createQuestionSchema", () => {
  it("accepts a well-formed multiple choice question and splits options", () => {
    const parsed = createQuestionSchema.parse(form());
    expect(parsed.options).toEqual(["20", "25", "30"]);
    expect(parsed.subtype).toBeNull();
    expect(parsed.exhibit).toBeNull();
  });

  it("requires the correct answer to be one of the options", () => {
    const result = createQuestionSchema.safeParse(form({ correctAnswer: "26" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/exactly match/);
  });

  it("needs at least two options for multiple choice, exactly two for true/false", () => {
    expect(createQuestionSchema.safeParse(form({ options: "only", correctAnswer: "only" })).success).toBe(false);
    expect(createQuestionSchema.safeParse(form({ questionType: "true_false", options: "True\nFalse\nMaybe", correctAnswer: "True" })).success).toBe(false);
    expect(createQuestionSchema.safeParse(form({ questionType: "true_false", options: "True\nFalse", correctAnswer: "False" })).success).toBe(true);
  });

  it("rejects duplicate options", () => {
    expect(createQuestionSchema.safeParse(form({ options: "20\n20\n30", correctAnswer: "20" })).success).toBe(false);
  });

  it("lets free-text questions skip options and the correct answer", () => {
    expect(createQuestionSchema.safeParse(form({ questionType: "free_text", options: "", correctAnswer: "" })).success).toBe(true);
  });

  it("rejects an unknown difficulty", () => {
    expect(createQuestionSchema.safeParse(form({ difficulty: "impossible" })).success).toBe(false);
  });

  it("validates exhibit JSON and says which box is wrong", () => {
    const bad = createQuestionSchema.safeParse(form({ exhibit: "{nope" }));
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].message).toMatch(/Exhibit isn't valid JSON/);

    const wrongShape = createQuestionSchema.safeParse(form({ exhibit: JSON.stringify({ kind: "table", headers: ["A", "B"], rows: [["1"]] }) }));
    expect(wrongShape.success).toBe(false);

    const good = createQuestionSchema.safeParse(form({ exhibit: JSON.stringify({ kind: "table", headers: ["A", "B"], rows: [["1", "2"]] }) }));
    expect(good.success).toBe(true);
  });

  it("requires option figures to match the options one to one", () => {
    const figures = JSON.stringify([[{ kind: "circle" }], [{ kind: "square" }]]);
    expect(createQuestionSchema.safeParse(form({ optionFigures: figures })).success).toBe(false);
    expect(createQuestionSchema.safeParse(form({ options: "A\nB", correctAnswer: "A", optionFigures: figures })).success).toBe(true);
  });
});

describe("importQuestionsSchema", () => {
  it("defaults to a dry run", () => {
    expect(importQuestionsSchema.parse({ questionPackId: PACK, json: "[]" }).dryRun).toBe(true);
  });
  it("rejects a non-uuid pack", () => {
    expect(importQuestionsSchema.safeParse({ questionPackId: "x", json: "[]" }).success).toBe(false);
  });
});

describe("parseImportedQuestions", () => {
  const ok = { prompt: "Q1", options: ["a", "b"], correctAnswer: "a" };

  it("accepts valid questions and applies defaults", () => {
    const result = parseImportedQuestions(JSON.stringify([ok]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.questions[0].questionType).toBe("multiple_choice");
      expect(result.questions[0].isActive).toBe(true);
    }
  });

  it("rejects non-JSON, non-arrays, empty and oversize input", () => {
    expect(parseImportedQuestions("nope").ok).toBe(false);
    expect(parseImportedQuestions("{}").ok).toBe(false);
    expect(parseImportedQuestions("[]").ok).toBe(false);
    expect(parseImportedQuestions(JSON.stringify(Array.from({ length: 201 }, (_, i) => ({ ...ok, prompt: `Q${i}` })))).ok).toBe(false);
  });

  it("reports the question number of each problem", () => {
    const result = parseImportedQuestions(JSON.stringify([ok, { ...ok, prompt: "Q2", correctAnswer: "zzz" }, { prompt: "" }]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.startsWith("Question 2"))).toBe(true);
      expect(result.errors.some((e) => e.startsWith("Question 3"))).toBe(true);
      expect(result.errors.some((e) => e.startsWith("Question 1"))).toBe(false);
    }
  });

  it("rejects unknown fields (typos would otherwise be dropped silently)", () => {
    expect(parseImportedQuestions(JSON.stringify([{ ...ok, correctanswer: "a" }])).ok).toBe(false);
  });

  it("rejects duplicates within one import", () => {
    const result = parseImportedQuestions(JSON.stringify([ok, ok]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/duplicates/);
  });
});
