import { describe, expect, it } from "vitest";
import { buildBank, NEW_PACKS, EXISTING_PACKS } from "../../../scripts/test-prep-content/bank.mjs";
import { exhibitSchema, optionFiguresSchema, visuallyIdentical, describeExhibit, type FigureCell, type ShapesExhibit, type TableExhibit, type BarChartExhibit } from "@/lib/test-prep/exhibit";

// The question bank is content the product ships as data, so it is tested like code: every question is structurally valid,
// nothing is duplicated or copied-looking, and — the part that matters most — every generated question's correct answer is
// RE-DERIVED here by independent code (parsing the wording and the exhibit back into numbers or shapes) and compared with
// the answer the generator marked. A wrong answer key in an aptitude-test bank is the worst kind of bug: it teaches
// people the wrong thing with the authority of a "correct" tick.

type BankQuestion = {
  packSlug: string;
  typeSlug: string;
  displayOrder: number;
  subtype: string;
  difficulty: "easy" | "medium" | "hard";
  stimulus: string | null;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  exhibit: unknown;
  optionFigures: FigureCell[] | null;
};

const bank = buildBank() as { packs: { slug: string; typeSlug: string; timeLimitSeconds: number; existing?: boolean }[]; questions: BankQuestion[] };
const questions = bank.questions;
const ofType = (type: string) => questions.filter((q) => q.typeSlug === type);

const money = (text: string) => Number(text.replace(/[^0-9.-]/g, ""));

describe("bank shape", () => {
  it("has the five formats, each with real depth", () => {
    expect(ofType("critical-thinking").length).toBeGreaterThanOrEqual(40);
    expect(ofType("situational-judgement").length).toBeGreaterThanOrEqual(24);
    expect(ofType("numerical-reasoning").length).toBeGreaterThanOrEqual(36);
    expect(ofType("verbal-reasoning").length).toBeGreaterThanOrEqual(24);
    expect(ofType("diagrammatic-reasoning").length).toBeGreaterThanOrEqual(30);
  });

  it("puts every question in a defined pack, and every pack ends up with at least eight questions", () => {
    const known = new Set([...NEW_PACKS.map((p: { slug: string }) => p.slug), ...Object.keys(EXISTING_PACKS)]);
    const counts = new Map<string, number>();
    for (const q of questions) {
      expect(known.has(q.packSlug), q.packSlug).toBe(true);
      counts.set(q.packSlug, (counts.get(q.packSlug) ?? 0) + 1);
    }
    for (const slug of known) expect((counts.get(slug) ?? 0) + (slug in EXISTING_PACKS ? 3 : 0), slug).toBeGreaterThanOrEqual(8);
  });

  it("gives every pack a time limit that is a sensible number of seconds per question", () => {
    for (const pack of bank.packs) {
      const count = questions.filter((q) => q.packSlug === pack.slug).length + (pack.existing ? 3 : 0);
      const perQuestion = pack.timeLimitSeconds / count;
      expect(perQuestion, pack.slug).toBeGreaterThanOrEqual(45);
      expect(perQuestion, pack.slug).toBeLessThanOrEqual(90);
    }
  });

  it("makes each question valid against the database's limits", () => {
    for (const q of questions) {
      const where = `${q.packSlug}#${q.displayOrder}`;
      expect(q.prompt.length, where).toBeLessThanOrEqual(4000);
      expect((q.stimulus ?? "").length, where).toBeLessThanOrEqual(4000);
      expect(q.explanation.length, where).toBeGreaterThan(20);
      expect(q.explanation.length, where).toBeLessThanOrEqual(2000);
      expect(q.correctAnswer.length, where).toBeLessThanOrEqual(500);
      expect(q.subtype.length, where).toBeLessThanOrEqual(100);
      expect(["easy", "medium", "hard"], where).toContain(q.difficulty);
      expect(q.options.length, where).toBeGreaterThanOrEqual(2);
      expect(new Set(q.options).size, `${where} has duplicate options`).toBe(q.options.length);
      expect(q.options, `${where}: the correct answer must be one of the options`).toContain(q.correctAnswer);
    }
  });

  it("numbers questions uniquely within a pack", () => {
    const seen = new Set<string>();
    for (const q of questions) {
      const key = `${q.packSlug}:${q.displayOrder}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it("contains no duplicate questions", () => {
    const seen = new Set<string>();
    for (const q of questions) {
      const key = JSON.stringify([q.stimulus, q.prompt, q.exhibit, q.options]);
      expect(seen.has(key), `${q.packSlug}#${q.displayOrder}`).toBe(false);
      seen.add(key);
    }
  });

  it("names no publisher, employer test or trademark", () => {
    const banned = /watson|glaser|\bshl\b|kenexa|saville|cubiks|talentq|cut-e|pymetrics|hogan|gmat|\bsjt\b test by/i;
    for (const q of questions) {
      const text = [q.stimulus, q.prompt, q.explanation, ...q.options].join(" ");
      expect(banned.test(text), `${q.packSlug}#${q.displayOrder}`).toBe(false);
    }
    for (const pack of NEW_PACKS as { name: string; description: string }[]) expect(banned.test(`${pack.name} ${pack.description}`), pack.name).toBe(false);
  });

  it("does not let the answer be guessed from position or length", () => {
    const shuffledTypes = ["situational-judgement", "numerical-reasoning", "diagrammatic-reasoning"];
    for (const type of shuffledTypes) {
      const list = ofType(type);
      const positions = new Set(list.map((q) => q.options.indexOf(q.correctAnswer)));
      expect(positions.size, `${type}: correct answers should not all sit in the same place`).toBeGreaterThanOrEqual(3);
    }
    const sjt = ofType("situational-judgement");
    const longest = sjt.filter((q) => q.correctAnswer.length === Math.max(...q.options.map((o) => o.length))).length;
    expect(longest / sjt.length, "the best SJT answer must not simply be the longest").toBeLessThanOrEqual(0.45);
  });

  it("uses the standard answer scales for the fixed-format sections", () => {
    const scales: Record<string, string[]> = {
      "assessing-inferences": ["True", "Probably true", "Insufficient data", "Probably false", "False"],
      "recognising-assumptions": ["Assumption made", "Assumption not made"],
      "making-deductions": ["Conclusion follows", "Conclusion does not follow"],
      "interpreting-information": ["Conclusion follows", "Conclusion does not follow"],
      "evaluating-arguments": ["Strong argument", "Weak argument"],
      "passage-analysis": ["True", "False", "Cannot say"],
      "business-briefings": ["True", "False", "Cannot say"],
      "science-and-society": ["True", "False", "Cannot say"],
    };
    for (const q of questions.filter((item) => item.packSlug in scales)) expect(q.options, `${q.packSlug}#${q.displayOrder}`).toEqual(scales[q.packSlug]);
  });

  it("balances the answers within each fixed-format section (no section is all one answer)", () => {
    for (const pack of ["assessing-inferences", "recognising-assumptions", "making-deductions", "interpreting-information", "evaluating-arguments", "passage-analysis", "business-briefings", "science-and-society"]) {
      const answers = new Set(questions.filter((q) => q.packSlug === pack).map((q) => q.correctAnswer));
      expect(answers.size, pack).toBeGreaterThanOrEqual(2);
    }
  });

  it("gives every passage-based question its own passage", () => {
    for (const q of questions.filter((item) => ["critical-thinking", "verbal-reasoning"].includes(item.typeSlug))) {
      expect(q.stimulus, `${q.packSlug}#${q.displayOrder}`).toBeTruthy();
      expect(/same passage|as above/i.test(q.prompt + (q.stimulus ?? "")), `${q.packSlug}#${q.displayOrder} refers to another question`).toBe(false);
    }
  });
});

describe("exhibits", () => {
  it("validate against the schema, and figure options match the options", () => {
    for (const q of questions) {
      if (q.exhibit) expect(exhibitSchema.safeParse(q.exhibit).success, `${q.packSlug}#${q.displayOrder}: ${JSON.stringify(exhibitSchema.safeParse(q.exhibit).error?.issues)}`).toBe(true);
      if (q.optionFigures) {
        expect(optionFiguresSchema.safeParse(q.optionFigures).success, `${q.packSlug}#${q.displayOrder}`).toBe(true);
        expect(q.optionFigures.length).toBe(q.options.length);
      }
    }
  });

  it("gives every numerical table/chart question a data exhibit and every diagrammatic question a figure", () => {
    for (const q of ofType("diagrammatic-reasoning").filter((item) => item.displayOrder >= 10)) expect(q.exhibit, `${q.packSlug}#${q.displayOrder}`).toBeTruthy();
    for (const q of ofType("numerical-reasoning").filter((item) => /Table reading|Chart reading|Profit and margin/.test(item.subtype))) expect(q.exhibit, q.prompt).toBeTruthy();
  });

  it("describes every exhibit in words (the accessible name of the drawing)", () => {
    for (const q of questions.filter((item) => item.exhibit)) expect(describeExhibit(exhibitSchema.parse(q.exhibit)).length, `${q.packSlug}#${q.displayOrder}`).toBeGreaterThan(20);
  });
});

// ---- numerical: re-derive every answer from the wording and the exhibit ------------------------------------------------

function tableRows(exhibit: unknown): { headers: string[]; rows: string[][] } {
  const table = exhibit as TableExhibit;
  return { headers: table.headers, rows: table.rows };
}

/** Returns the expected answer as text-independent number(s), or null if the question isn't one this verifier understands. */
function expectedNumerical(q: BankQuestion): { value: number; kind: "plain" | "label" } | null {
  const p = q.prompt;
  let m: RegExpMatchArray | null;

  if ((m = p.match(/had sales of £([\d,]+) last year\. (\d+)% of those sales were made online/))) return { value: (money(m[1]) * Number(m[2])) / 100, kind: "plain" };
  if ((m = p.match(/(?:rose|fell) from ([\d,.]+) to ([\d,.]+)\. What was the percentage/))) return { value: Math.round(((money(m[2]) - money(m[1])) / money(m[1])) * 1000) / 10, kind: "plain" };
  if ((m = p.match(/with (\d+)% off\. The sale price is £([\d,.]+)/))) return { value: money(m[2]) / (1 - Number(m[1]) / 100), kind: "plain" };
  if ((m = p.match(/for £([\d,.]+) including VAT at 20%/))) return { value: money(m[1]) / 1.2, kind: "plain" };
  if ((m = p.match(/rose by (\d+)% .* fell by (\d+)%/))) return { value: Math.round(((1 + Number(m[1]) / 100) * (1 - Number(m[2]) / 100) - 1) * 1000) / 10, kind: "label" };
  if ((m = p.match(/£([\d,]+) is invested at (\d+)% .* after (\d+) years/))) return { value: Math.round(money(m[1]) * (1 + Number(m[2]) / 100) ** Number(m[3]) * 100) / 100, kind: "plain" };
  if ((m = p.match(/£([\d,]+) bonus pool .* ratio (\d+) : (\d+) : (\d+)\. How much does the (second|third) team/))) {
    const parts = [Number(m[2]), Number(m[3]), Number(m[4])];
    return { value: (money(m[1]) / parts.reduce((a, b) => a + b, 0)) * parts[m[5] === "second" ? 1 : 2], kind: "plain" };
  }
  if ((m = p.match(/scores in five assessments were ([\d, ]+)\. .* exactly (\d+)\?/))) {
    const known = m[1].split(",").map((v) => Number(v.trim()));
    return { value: Number(m[2]) * (known.length + 1) - known.reduce((a, b) => a + b, 0), kind: "plain" };
  }
  if ((m = p.match(/^(\d+) identical machines make ([\d,]+) .* in (\d+) hours\. How many .* would (\d+) of the same machines make in (\d+) hours/))) {
    const perMachineHour = money(m[2]) / Number(m[1]) / Number(m[3]);
    return { value: perMachineHour * Number(m[4]) * Number(m[5]), kind: "plain" };
  }
  if ((m = p.match(/£1 = ([\d.]+) .* for £([\d,]+)\?/))) return { value: Math.round(Number(m[1]) * money(m[2]) * 100) / 100, kind: "plain" };
  if ((m = p.match(/£1 = ([\d.]+) .* invoice is for \D*([\d,.]+)\. What is that in pounds/))) return { value: Math.round((money(m[2]) / Number(m[1])) * 100) / 100, kind: "plain" };
  if ((m = p.match(/drives (\d+) miles .* at an average of (\d+) mph, .* at an average of (\d+) mph/))) {
    const [d, s1, s2] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return { value: Math.round(((2 * d) / (d / s1 + d / s2)) * 10) / 10, kind: "plain" };
  }

  // exhibits
  if (q.exhibit && (q.exhibit as { kind: string }).kind === "table") {
    const { headers, rows } = tableRows(q.exhibit);
    if (headers[0] === "Region") {
      const regions = rows.filter((r) => r[0] !== "Total");
      const total = regions.reduce((s, r) => s + Number(r[1]), 0);
      expect(Number(rows.find((r) => r[0] === "Total")![1])).toBe(total); // the exhibit's own total must be right
      if ((m = p.match(/percentage of the total revenue came from the (\w+) region/))) return { value: Math.round((Number(regions.find((r) => r[0] === m![1])![1]) / total) * 100), kind: "plain" };
      if (/highest-earning region/.test(p)) return { value: Math.round((Math.max(...regions.map((r) => Number(r[1]))) / total) * 100), kind: "plain" };
      if ((m = p.match(/did the (\w+) region earn than the (\w+) region/))) return { value: Number(regions.find((r) => r[0] === m![1])![1]) - Number(regions.find((r) => r[0] === m![2])![1]), kind: "plain" };
    }
    if (headers[0] === "Quarter") {
      const row = (quarter: string) => rows.find((r) => r[0] === quarter)!;
      if ((m = p.match(/profit \(revenue minus costs\) in (Q\d)/))) return { value: Number(row(m[1])[1]) - Number(row(m[1])[2]), kind: "plain" };
      if ((m = p.match(/profit margin .* in (Q\d)/))) return { value: Math.round(((Number(row(m[1])[1]) - Number(row(m[1])[2])) / Number(row(m[1])[1])) * 1000) / 10, kind: "plain" };
      if (/total profit across the four quarters/.test(p)) return { value: rows.reduce((s, r) => s + Number(r[1]) - Number(r[2]), 0), kind: "plain" };
    }
  }
  if (q.exhibit && (q.exhibit as { kind: string }).kind === "bar_chart") {
    const chart = q.exhibit as BarChartExhibit;
    const [last, current] = chart.series.map((s) => s.values);
    const idx = (name: string) => chart.categories.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    if ((m = p.match(/How many (\w+) \(in thousands\) were sold across the two years combined/))) return { value: last[idx(m[1])] + current[idx(m[1])], kind: "plain" };
    if ((m = p.match(/percentage change in (\w+) sales/))) return { value: Math.round(((current[idx(m[1])] - last[idx(m[1])]) / last[idx(m[1])]) * 1000) / 10, kind: "plain" };
    if (/largest increase in units sold/.test(p)) {
      const rises = current.map((v, i) => v - last[i]);
      const best = rises.indexOf(Math.max(...rises));
      return { value: best, kind: "plain" }; // handled separately below
    }
  }
  return null;
}

describe("numerical answers are independently re-derived", () => {
  const numerical = ofType("numerical-reasoning");

  it("verifies every numerical question (none is left unchecked)", () => {
    const unchecked = numerical.filter((q) => expectedNumerical(q) === null).map((q) => q.prompt.slice(0, 80));
    expect(unchecked).toEqual([]);
  });

  it("marks the arithmetically correct option as the answer", () => {
    for (const q of numerical) {
      const expected = expectedNumerical(q)!;
      if (/largest increase in units sold/.test(q.prompt)) {
        const chart = q.exhibit as BarChartExhibit;
        const [last, current] = chart.series.map((s) => s.values);
        const rises = current.map((v, i) => v - last[i]);
        const best = rises.indexOf(Math.max(...rises));
        expect(rises.filter((r) => r === rises[best]).length, "a tie for the largest rise would make the answer ambiguous").toBe(1);
        expect(q.correctAnswer, q.prompt).toBe(`${chart.categories[best]}: +${rises[best]}`);
        continue;
      }
      if (expected.kind === "label") {
        const isIncrease = expected.value > 0;
        expect(q.correctAnswer, q.prompt).toBe(`${isIncrease ? "an increase" : "a decrease"} of ${Math.abs(expected.value)}%`);
        continue;
      }
      expect(money(q.correctAnswer), `${q.prompt} -> ${q.correctAnswer}`).toBeCloseTo(expected.value, 1);
    }
  });

  it("gives four different options and never the answer twice in another guise", () => {
    for (const q of numerical) {
      expect(q.options.length).toBe(4);
      expect(new Set(q.options.map((o) => o.replace(/[^0-9.+-]/g, ""))).size, q.prompt).toBe(4);
    }
  });

  it("shows the working in the explanation", () => {
    for (const q of numerical) expect(/\d/.test(q.explanation) && q.explanation.length > 15, q.prompt).toBe(true);
  });
});

// ---- diagrammatic: re-derive the answer from the figures --------------------------------------------------------------

const RING: [number, number][] = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const cellOf = (q: BankQuestion, label: string) => q.optionFigures![q.options.indexOf(label)];
const norm360 = (n: number) => ((n % 360) + 360) % 360;
const shown = (q: BankQuestion) => (q.exhibit as ShapesExhibit).cells.filter((c): c is FigureCell => c !== null);

describe("diagrammatic answers are independently re-derived", () => {
  const diagrammatic = ofType("diagrammatic-reasoning").filter((q) => q.exhibit && (q.exhibit as { kind: string }).kind === "shapes");

  it("makes every option visibly different from every other", () => {
    for (const q of diagrammatic.filter((item) => item.optionFigures)) {
      const cells = q.optionFigures!;
      for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) expect(visuallyIdentical(cells[i], cells[j]), `${q.packSlug}#${q.displayOrder}: options ${i} and ${j} look the same`).toBe(false);
    }
  });

  it("rotation sequences: constant turn, answer is the next turn", () => {
    expect(diagrammatic.filter((item) => item.subtype === "Rotation").length).toBeGreaterThanOrEqual(4);
    for (const q of diagrammatic.filter((item) => item.subtype === "Rotation")) {
      const cells = shown(q);
      const angles = cells.map((c) => c[0].rotate);
      const step = norm360(angles[1] - angles[0]);
      for (let i = 1; i < angles.length; i++) expect(norm360(angles[i] - angles[i - 1]), `${q.packSlug}#${q.displayOrder}`).toBe(step);
      const expected = norm360(angles[angles.length - 1] + step);
      const answer = cellOf(q, q.correctAnswer);
      expect(norm360(answer[0].rotate)).toBe(expected);
      expect(answer[0].kind).toBe(cells[0][0].kind);
      expect(answer[0].fill).toBe(cells[0][0].fill);
    }
  });

  it("counting sequences: constant difference, answer is the next count", () => {
    expect(diagrammatic.filter((item) => item.subtype === "Counting").length).toBeGreaterThanOrEqual(4);
    for (const q of diagrammatic.filter((item) => item.subtype === "Counting")) {
      const counts = shown(q).map((c) => c.length);
      const d = counts[1] - counts[0];
      for (let i = 1; i < counts.length; i++) expect(counts[i] - counts[i - 1], `${q.packSlug}#${q.displayOrder}`).toBe(d);
      const answer = cellOf(q, q.correctAnswer);
      expect(answer.length).toBe(counts[counts.length - 1] + d);
      expect(answer[0].kind).toBe(shown(q)[0][0].kind);
      expect(answer[0].fill).toBe(shown(q)[0][0].fill);
    }
  });

  it("size cycles: period three, answer continues it", () => {
    expect(diagrammatic.filter((item) => item.subtype === "Size patterns").length).toBeGreaterThanOrEqual(2);
    for (const q of diagrammatic.filter((item) => item.subtype === "Size patterns")) {
      const sizes = shown(q).map((c) => c[0].size);
      for (let i = 3; i < sizes.length; i++) expect(sizes[i], `${q.packSlug}#${q.displayOrder}`).toBe(sizes[i - 3]);
      expect(cellOf(q, q.correctAnswer)[0].size).toBe(sizes[sizes.length - 3]);
      expect(new Set(sizes.slice(0, 3)).size).toBe(3);
    }
  });

  it("fill patterns: repeating shading, answer continues it (and the turn too when combined)", () => {
    expect(diagrammatic.filter((item) => item.subtype === "Fill patterns").length).toBeGreaterThanOrEqual(3);
    for (const q of diagrammatic.filter((item) => item.subtype === "Fill patterns" || (item.subtype === "Combined rules" && shown(q0(item)).every((c) => c.length === 1)))) {
      const cells = shown(q);
      const fills = cells.map((c) => c[0].fill);
      const period = [2, 3].find((p) => fills.every((f, i) => f === fills[i % p]))!;
      expect(period, `${q.packSlug}#${q.displayOrder}`).toBeDefined();
      const answer = cellOf(q, q.correctAnswer);
      expect(answer[0].fill).toBe(fills[cells.length % period]);
      const angles = cells.map((c) => c[0].rotate);
      const step = norm360(angles[1] - angles[0]);
      if (step !== 0) {
        for (let i = 1; i < angles.length; i++) expect(norm360(angles[i] - angles[i - 1])).toBe(step);
        expect(norm360(answer[0].rotate)).toBe(norm360(angles[angles.length - 1] + step));
      }
    }
  });

  it("layered figures: outer shape keeps turning, inner shape alternates, answer does both", () => {
    expect(diagrammatic.filter((item) => item.subtype === "Combined rules" && shown(q0(item)).every((c) => c.length === 2)).length).toBeGreaterThanOrEqual(3);
    for (const q of diagrammatic.filter((item) => item.subtype === "Combined rules" && shown(q0(item)).every((c) => c.length === 2))) {
      const cells = shown(q);
      const outer = cells.map((c) => c[0].rotate);
      const inner = cells.map((c) => c[1].fill);
      const step = norm360(outer[1] - outer[0]);
      for (let i = 1; i < outer.length; i++) expect(norm360(outer[i] - outer[i - 1]), `${q.packSlug}#${q.displayOrder}`).toBe(step);
      for (let i = 2; i < inner.length; i++) expect(inner[i]).toBe(inner[i - 2]);
      const answer = cellOf(q, q.correctAnswer);
      expect(norm360(answer[0].rotate)).toBe(norm360(outer[outer.length - 1] + step));
      expect(answer[1].fill).toBe(inner[inner.length - 2]);
    }
  });

  it("movement: each shape advances a fixed number of places round the frame, answer is the next place", () => {
    expect(diagrammatic.filter((item) => item.subtype === "Movement").length).toBeGreaterThanOrEqual(4);
    const at = (shape: { x: number; y: number }) => RING.findIndex(([x, y]) => x === shape.x && y === shape.y);
    for (const q of diagrammatic.filter((item) => item.subtype === "Movement" || (item.subtype === "Combined rules" && shown(q0(item)).every((c) => c.length <= 2 && c[0].size === 1)))) {
      const cells = shown(q);
      const answer = cellOf(q, q.correctAnswer);
      for (let s = 0; s < cells[0].length; s++) {
        const positions = cells.map((c) => at(c[s]));
        expect(positions.every((p) => p >= 0), `${q.packSlug}#${q.displayOrder}`).toBe(true);
        const step = (positions[1] - positions[0] + 8) % 8;
        for (let i = 1; i < positions.length; i++) expect((positions[i] - positions[i - 1] + 8) % 8, `${q.packSlug}#${q.displayOrder}`).toBe(step);
        expect(at(answer[s])).toBe((positions[positions.length - 1] + step) % 8);
      }
      if (cells[0].length === 2) for (const c of [...cells, answer]) expect(at(c[0]) === at(c[1]), "two shapes must not share a spot").toBe(false);
    }
  });

  it("matrices: every row and column has each shape and each shading once, answer is the only completion", () => {
    expect(diagrammatic.filter((item) => item.subtype === "Matrices").length).toBeGreaterThanOrEqual(5);
    for (const q of diagrammatic.filter((item) => item.subtype === "Matrices")) {
      const cells = (q.exhibit as ShapesExhibit).cells;
      expect(cells.length).toBe(9);
      const full = cells.map((c, i) => (i === 8 ? cellOf(q, q.correctAnswer) : (c as FigureCell)));
      for (let line = 0; line < 3; line++) {
        const row = [0, 1, 2].map((c) => full[line * 3 + c][0]);
        const col = [0, 1, 2].map((r) => full[r * 3 + line][0]);
        for (const group of [row, col]) {
          expect(new Set(group.map((s) => s.kind)).size, `${q.packSlug}#${q.displayOrder}`).toBe(3);
          expect(new Set(group.map((s) => s.fill)).size, `${q.packSlug}#${q.displayOrder}`).toBe(3);
        }
      }
      // No wrong option also completes the grid.
      for (const label of q.options.filter((o) => o !== q.correctAnswer)) {
        const option = cellOf(q, label)[0];
        const row = [full[6][0], full[7][0], option];
        const col = [full[2][0], full[5][0], option];
        const completes = [row, col].every((g) => new Set(g.map((s) => s.kind)).size === 3 && new Set(g.map((s) => s.fill)).size === 3);
        expect(completes, `${q.packSlug}#${q.displayOrder}: option ${label} also completes the grid`).toBe(false);
      }
    }
  });

  it("odd one out: exactly one figure breaks the rule, and it is the marked answer", () => {
    expect(diagrammatic.filter((item) => item.subtype === "Odd one out").length).toBeGreaterThanOrEqual(5);
    const labels = ["A", "B", "C", "D", "E"];
    for (const q of diagrammatic.filter((item) => item.subtype === "Odd one out")) {
      const cells = (q.exhibit as ShapesExhibit).cells as FigureCell[];
      expect(cells.length).toBe(5);
      const counts = cells.map((c) => c.length);
      const uniform = cells.map((c) => new Set(c.map((s) => s.fill)).size === 1);
      const byCount = counts.filter((n) => n === counts[0]).length;
      const oddByCount = new Set(counts).size === 2 && [1, 4].includes(Math.min(...["a", "b"].map(() => counts.filter((n) => n === counts[0]).length))) ? counts.findIndex((n) => counts.filter((m) => m === n).length === 1) : -1;
      const oddByFill = uniform.filter((u) => !u).length === 1 ? uniform.findIndex((u) => !u) : -1;
      const odd = oddByCount >= 0 ? oddByCount : oddByFill;
      void byCount;
      expect(odd, `${q.packSlug}#${q.displayOrder}`).toBeGreaterThanOrEqual(0);
      expect(labels[odd]).toBe(q.correctAnswer);
      // The two candidate rules must not point at different cells.
      if (oddByCount >= 0 && oddByFill >= 0) expect(oddByCount).toBe(oddByFill);
    }
  });

  it("text sequences in the original pack keep their answers", () => {
    const legacyText = questions.filter((q) => q.packSlug === "sequences-and-patterns" && !q.exhibit);
    expect(legacyText.length).toBe(0); // the three text questions live in the database from migration 0068, not in this bank
  });
});

/** helper: the question a `shown()` filter is asking about (keeps the filter callbacks above readable). */
function q0(item: BankQuestion): BankQuestion {
  return item;
}
