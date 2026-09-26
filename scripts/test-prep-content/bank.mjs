// The Test Prep question bank, assembled from the generators and hand-written sets in this folder. `buildBank()` is
// deterministic (seeded), and is what both the migration builder (build-migration.mjs) and the content tests
// (src/lib/test-prep/content.test.ts) read — so what is tested is exactly what ships.

import { makeRng } from "./rng.mjs";
import { criticalThinking, criticalThinkingPacks } from "./critical-thinking.mjs";
import { situationalJudgement, situationalPacks, verbalReasoning, verbalPacks } from "./sjt-and-verbal.mjs";
import { generateNumerical } from "./numerical.mjs";
import { generateDiagrammatic } from "./diagrammatic.mjs";

/** Packs that already exist in the database (migration 0068) and only gain questions and a proper time limit. */
export const EXISTING_PACKS = {
  "assessing-inferences": { typeSlug: "critical-thinking", secondsPerQuestion: 60 },
  "graduate-programme-scenarios": { typeSlug: "situational-judgement", secondsPerQuestion: 60 },
  "data-interpretation": { typeSlug: "numerical-reasoning", secondsPerQuestion: 75 },
  "passage-analysis": { typeSlug: "verbal-reasoning", secondsPerQuestion: 75 },
  "sequences-and-patterns": { typeSlug: "diagrammatic-reasoning", secondsPerQuestion: 45 },
};

const numericalPacks = [
  { typeSlug: "numerical-reasoning", slug: "percentages-and-change", name: "Numerical Reasoning: Percentages & Change", description: "Percentages of amounts, percentage change, reversing VAT and discounts, successive changes and compound interest.", sectorStyle: "Banking & Finance", secondsPerQuestion: 75 },
  { typeSlug: "numerical-reasoning", slug: "ratios-and-rates", name: "Numerical Reasoning: Ratios, Averages & Rates", description: "Sharing in a ratio, missing averages, rates of work, currency conversion and average speed.", sectorStyle: "Logistics & Operations", secondsPerQuestion: 75 },
  { typeSlug: "numerical-reasoning", slug: "charts-and-tables", name: "Numerical Reasoning: Charts & Tables", description: "Read a bar chart or a table and work out totals, shares, changes and margins.", sectorStyle: "Accounting & Audit", secondsPerQuestion: 90 },
];

const diagrammaticPacks = [
  { typeSlug: "diagrammatic-reasoning", slug: "shape-transformations", name: "Diagrammatic Reasoning: Shape Transformations", description: "Shading cycles, rotations and layered shapes — sometimes two rules at once.", sectorStyle: "Technology", secondsPerQuestion: 45 },
  { typeSlug: "diagrammatic-reasoning", slug: "movement-patterns", name: "Diagrammatic Reasoning: Movement & Counting", description: "Shapes that move around a frame, and counts and sizes that change step by step.", sectorStyle: "Engineering", secondsPerQuestion: 45 },
  { typeSlug: "diagrammatic-reasoning", slug: "matrices-and-odd-one-out", name: "Diagrammatic Reasoning: Matrices & Odd One Out", description: "Complete a 3 × 3 grid, or find the figure that breaks the rule.", sectorStyle: "Technology", secondsPerQuestion: 60 },
];

export const NEW_PACKS = [...criticalThinkingPacks, ...situationalPacks, ...numericalPacks, ...verbalPacks, ...diagrammaticPacks];

/** Existing rows (0067) whose passages said "Same passage as above" and so made no sense out of order, plus tags for the rest. */
export const LEGACY_QUESTIONS = [
  {
    pack: "assessing-inferences", order: 1, subtype: "Inference", difficulty: "medium",
    stimulus: "A mid-sized retail chain reports that stores which introduced self-checkout kiosks saw an 8% rise in average transaction speed, but also a 15% rise in reported stock discrepancies over the same quarter.",
    prompt: 'Inference: "Self-checkout kiosks caused the rise in stock discrepancies."\n\nHow should this inference be rated, based only on the passage?',
  },
  {
    pack: "assessing-inferences", order: 2, subtype: "Inference", difficulty: "easy",
    stimulus: "A mid-sized retail chain reports that stores which introduced self-checkout kiosks saw an 8% rise in average transaction speed, but also a 15% rise in reported stock discrepancies over the same quarter.",
    prompt: 'Inference: "The rise in transaction speed was measured in stores that introduced self-checkout kiosks."\n\nHow should this inference be rated, based only on the passage?',
  },
  {
    pack: "assessing-inferences", order: 3, subtype: "Inference", difficulty: "hard",
    stimulus: "A mid-sized retail chain reports that stores which introduced self-checkout kiosks saw an 8% rise in average transaction speed, but also a 15% rise in reported stock discrepancies over the same quarter.",
    prompt: 'Inference: "Self-checkout kiosks are a net negative for this retail chain overall."\n\nHow should this inference be rated, based only on the passage?',
  },
  {
    pack: "passage-analysis", order: 1, subtype: "True / False / Cannot say", difficulty: "medium",
    stimulus: "A recent change to workplace policy at a mid-sized law firm requires all client correspondence above a specified value threshold to be reviewed by a second qualified solicitor before being sent. The firm's managing partner stated the change was introduced after a small number of drafting errors were identified in high-value client communications over the previous year.",
    prompt: 'Statement: "The new policy applies to all client correspondence, regardless of value."\n\nBased only on the passage, is the statement true, false, or can you not say?',
  },
  {
    pack: "passage-analysis", order: 2, subtype: "True / False / Cannot say", difficulty: "medium",
    stimulus: "A recent change to workplace policy at a mid-sized law firm requires all client correspondence above a specified value threshold to be reviewed by a second qualified solicitor before being sent. The firm's managing partner stated the change was introduced after a small number of drafting errors were identified in high-value client communications over the previous year.",
    prompt: 'Statement: "Drafting errors had never occurred at the firm before the previous year."\n\nBased only on the passage, is the statement true, false, or can you not say?',
  },
  {
    pack: "passage-analysis", order: 3, subtype: "True / False / Cannot say", difficulty: "easy",
    stimulus: "A recent change to workplace policy at a mid-sized law firm requires all client correspondence above a specified value threshold to be reviewed by a second qualified solicitor before being sent. The firm's managing partner stated the change was introduced after a small number of drafting errors were identified in high-value client communications over the previous year.",
    prompt: 'Statement: "The policy change was a direct response to identified drafting errors."\n\nBased only on the passage, is the statement true, false, or can you not say?',
  },
  { pack: "graduate-programme-scenarios", order: 1, subtype: "Integrity", difficulty: "medium" },
  { pack: "graduate-programme-scenarios", order: 2, subtype: "Teamwork", difficulty: "medium" },
  { pack: "graduate-programme-scenarios", order: 3, subtype: "Communication", difficulty: "medium" },
  { pack: "data-interpretation", order: 1, subtype: "Percentage change", difficulty: "medium" },
  { pack: "data-interpretation", order: 2, subtype: "Profit and margin", difficulty: "medium" },
  { pack: "data-interpretation", order: 3, subtype: "Percentages", difficulty: "easy" },
  { pack: "sequences-and-patterns", order: 1, subtype: "Sequences", difficulty: "easy" },
  { pack: "sequences-and-patterns", order: 2, subtype: "Number sequences", difficulty: "easy" },
  { pack: "sequences-and-patterns", order: 3, subtype: "Counting", difficulty: "easy" },
];

/** Questions already in each pack (so new ones number on from there and the time limit covers all of them). */
const LEGACY_COUNT = { "assessing-inferences": 3, "graduate-programme-scenarios": 3, "data-interpretation": 3, "passage-analysis": 3, "sequences-and-patterns": 3 };

export function buildBank() {
  const rng = makeRng(20260927);
  const raw = [
    ...criticalThinking.map((q) => ({ ...q, typeSlug: "critical-thinking" })),
    ...situationalJudgement.map((q) => ({ ...q, typeSlug: "situational-judgement" })),
    ...generateNumerical().map((q) => ({ ...q, typeSlug: "numerical-reasoning" })),
    ...verbalReasoning.map((q) => ({ ...q, typeSlug: "verbal-reasoning" })),
    ...generateDiagrammatic().map((q) => ({ ...q, typeSlug: "diagrammatic-reasoning" })),
  ];

  const nextOrder = {};
  const questions = raw.map((q) => {
    // The hand-written SJT sets list the best answer first; put the options in a seeded random order.
    const options = q.bestFirst ? rng.shuffle(q.options) : q.options;
    nextOrder[q.pack] = (nextOrder[q.pack] ?? 9) + 1;
    return {
      packSlug: q.pack,
      typeSlug: q.typeSlug,
      displayOrder: nextOrder[q.pack],
      questionType: "multiple_choice",
      subtype: q.subtype,
      difficulty: q.difficulty,
      stimulus: q.stimulus ?? null,
      prompt: q.prompt,
      options,
      correctAnswer: q.correct,
      explanation: q.explanation,
      exhibit: q.exhibit ?? null,
      optionFigures: q.optionFigures ?? null,
    };
  });

  const countByPack = {};
  for (const q of questions) countByPack[q.packSlug] = (countByPack[q.packSlug] ?? 0) + 1;

  const packs = [
    ...NEW_PACKS.map((p) => ({ ...p, timeLimitSeconds: (countByPack[p.slug] ?? 0) * p.secondsPerQuestion })),
    ...Object.entries(EXISTING_PACKS).map(([slug, p]) => ({
      slug,
      typeSlug: p.typeSlug,
      existing: true,
      timeLimitSeconds: ((countByPack[slug] ?? 0) + LEGACY_COUNT[slug]) * p.secondsPerQuestion,
    })),
  ];

  return { packs, questions, legacy: LEGACY_QUESTIONS };
}
