// Diagrammatic reasoning questions, generated from explicit rules so that every answer is correct by construction and
// every distractor is a *specific wrong rule* (the wrong rotation, the wrong fill, the count one off ...), not a random
// picture. Nothing here imitates any published test: the rule families (a shape turning by a fixed step, a count growing,
// a fill cycle, a shape circling a frame, a Latin-square matrix, an odd one out) are generic, and every figure is drawn
// from this file's own parameters.
//
// Output questions carry `exhibit` (shapes) and `optionFigures` in the JSON shape src/lib/test-prep/exhibit.ts validates.

import { makeRng } from "./rng.mjs";

const LABELS = ["A", "B", "C", "D", "E"];

export const shape = (kind, o = {}) => ({ kind, fill: o.fill ?? "white", rotate: norm(o.rotate ?? 0), size: o.size ?? 2, x: o.x ?? 0, y: o.y ?? 0 });

function norm(angle) {
  return ((angle % 360) + 360) % 360;
}

// How many degrees before a shape looks the same again (mirrors src/lib/test-prep/exhibit.ts's visuallyIdentical).
const SYMMETRY = { circle: 360, dot: 360, square: 90, cross: 90, diamond: 180, hexagon: 180 };

function appearance(cell) {
  return JSON.stringify(
    cell
      .map((s) => [s.kind, s.fill, s.kind === "circle" || s.kind === "dot" ? 0 : s.rotate % (SYMMETRY[s.kind] ?? 360), s.size, s.x, s.y])
      .sort(),
  );
}

export const looksTheSame = (a, b) => appearance(a) === appearance(b);

/** Drops any distractor that duplicates the answer or another distractor, then keeps four. */
function chooseDistractors(correct, candidates) {
  const kept = [];
  for (const candidate of candidates) {
    if (looksTheSame(candidate, correct)) continue;
    if (kept.some((other) => looksTheSame(other, candidate))) continue;
    kept.push(candidate);
    if (kept.length === 4) break;
  }
  if (kept.length < 4) throw new Error(`Not enough distinct distractors (${kept.length}) for a diagrammatic question: ${JSON.stringify(correct)}`);
  return kept;
}

function build(rng, { id, subtype, difficulty, prompt, explanation, shown, correct, candidates, layout = "row", columns }) {
  const distractors = chooseDistractors(correct, candidates);
  const order = rng.shuffle([correct, ...distractors]);
  return {
    id,
    subtype,
    difficulty,
    prompt,
    options: LABELS.slice(0, order.length),
    optionFigures: order,
    correct: LABELS[order.findIndex((cell) => cell === correct)],
    explanation,
    exhibit: { kind: "shapes", layout, ...(columns ? { columns } : {}), cells: [...shown, null] },
  };
}

const ASYMMETRIC = ["arrow", "triangle", "star", "pentagon"];
const FILL_CHOICES = ["black", "white", "grey"];
const RING = [
  [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0],
];
const READING_ORDER = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];

// ---- one shape turning by a fixed step ------------------------------------------------------------------------------
function rotationSequence(rng, id) {
  const kind = rng.pick(ASYMMETRIC);
  const fill = rng.pick(FILL_CHOICES);
  const step = rng.pick([45, 90, 135, -45, -90]);
  const start = rng.pick([0, 45, 90, 180, 270]);
  const angle = (i) => start + i * step;
  const cell = (i, f = fill, k = kind) => [shape(k, { fill: f, rotate: angle(i), size: 3 })];
  const shown = [0, 1, 2, 3].map((i) => cell(i));
  const correct = cell(4);
  const wrongSteps = [step > 0 ? -step : -step, 2 * step, step + 45, step - 45, 180].map((s) => start + 3 * step + s);
  const candidates = [
    ...wrongSteps.map((a) => [shape(kind, { fill, rotate: a, size: 3 })]),
    [shape(kind, { fill: fill === "black" ? "white" : "black", rotate: angle(4), size: 3 })],
  ];
  const direction = step > 0 ? "clockwise" : "anticlockwise";
  return build(rng, {
    id,
    subtype: "Rotation",
    difficulty: Math.abs(step) === 90 ? "easy" : "medium",
    prompt: "Each figure follows the one before it by the same rule. Which figure replaces the question mark?",
    explanation: `Each figure is the one before it turned ${Math.abs(step)}° ${direction}. Turning the fourth figure another ${Math.abs(step)}° ${direction} gives the missing one; the other options turn by a different amount or change the shading.`,
    shown,
    correct,
    candidates,
  });
}

// ---- a count that grows or shrinks ----------------------------------------------------------------------------------
function countSequence(rng, id) {
  const kind = rng.pick(["circle", "square", "triangle", "diamond", "star"]);
  const fill = rng.pick(FILL_CHOICES);
  const growing = rng.next() < 0.6;
  const d = rng.pick([1, 2]);
  const start = growing ? rng.int(1, d === 2 ? 1 : 3) : 9 - rng.int(0, d === 2 ? 0 : 2);
  const count = (i) => start + (growing ? i : -i) * d;
  const cell = (n, f = fill, k = kind) => READING_ORDER.slice(0, n).map(([x, y]) => shape(k, { fill: f, size: 1, x, y }));
  const shown = [0, 1, 2, 3].map((i) => cell(count(i)));
  const target = count(4);
  const correct = cell(target);
  const candidates = [
    cell(target + 1),
    cell(target - 1),
    cell(target + (growing ? d : -d)),
    cell(count(3)),
    cell(target, fill === "black" ? "white" : "black"),
    cell(target, fill, kind === "circle" ? "square" : "circle"),
  ].filter((c) => c.length >= 1 && c.length <= 9);
  return build(rng, {
    id,
    subtype: "Counting",
    difficulty: d === 1 ? "easy" : "medium",
    prompt: "The number of shapes changes by the same amount each time. Which figure comes next?",
    explanation: `The figures contain ${[0, 1, 2, 3].map(count).join(", ")} shapes — ${growing ? "up" : "down"} by ${d} each time — so the next has ${target}. The other options have the wrong number, or the right number in a different shading or shape.`,
    shown,
    correct,
    candidates,
  });
}

// ---- size cycle -----------------------------------------------------------------------------------------------------
function sizeCycle(rng, id) {
  const kind = rng.pick(["circle", "square", "triangle", "diamond", "pentagon", "star"]);
  const fill = rng.pick(FILL_CHOICES);
  const cycle = rng.pick([[1, 2, 3], [3, 2, 1], [1, 3, 2]]);
  const size = (i) => cycle[i % 3];
  const cell = (s, f = fill, k = kind) => [shape(k, { fill: f, size: s })];
  const shown = [0, 1, 2, 3, 4].map((i) => cell(size(i)));
  const target = size(5);
  const correct = cell(target);
  const candidates = [1, 2, 3]
    .filter((s) => s !== target)
    .map((s) => cell(s))
    .concat([
      cell(target, fill === "black" ? "white" : "black"),
      cell(target, fill, kind === "circle" ? "square" : "circle"),
      cell(size(4), fill === "grey" ? "white" : "grey"),
      cell(size(3), fill === "hatch" ? "white" : "hatch"),
    ]);
  const names = { 1: "small", 2: "medium", 3: "large" };
  return build(rng, {
    id,
    subtype: "Size patterns",
    difficulty: "easy",
    prompt: "The shape changes size in a repeating pattern. Which figure comes next?",
    explanation: `The sizes repeat every three figures: ${[0, 1, 2].map((i) => names[size(i)]).join(", ")}. The sixth figure is therefore ${names[target]}. The other options break the repeat or change the shape or shading.`,
    shown,
    correct,
    candidates,
  });
}

// ---- a repeating fill (optionally combined with a rotation) ---------------------------------------------------------
function fillCycle(rng, id, combined) {
  const kind = rng.pick(combined ? ["arrow", "triangle", "pentagon"] : ["circle", "square", "diamond", "star", "triangle", "pentagon"]);
  const cycle = rng.pick([["black", "white"], ["black", "grey"], ["white", "hatch"], ["black", "white", "grey"], ["grey", "white", "black"]]);
  const step = rng.pick([90, -90, 45]);
  const start = rng.pick([0, 90, 180]);
  const fillAt = (i) => cycle[i % cycle.length];
  const cell = (i, f = fillAt(i), r = combined ? start + i * step : 0) => [shape(kind, { fill: f, rotate: r, size: 3 })];
  const shown = [0, 1, 2, 3, 4].map((i) => cell(i));
  const correct = cell(5);
  const otherFills = ["black", "white", "grey", "hatch"].filter((f) => f !== fillAt(5));
  const candidates = [
    ...otherFills.map((f) => cell(5, f)),
    ...(combined
      ? [cell(5, fillAt(5), start + 5 * step + 90), cell(5, fillAt(5), start + 5 * step - step * 2), cell(4, fillAt(5))]
      : [
          [shape(kind === "circle" ? "square" : "circle", { fill: fillAt(5), size: 3 })],
          [shape(kind, { fill: fillAt(5), size: 1 })],
          [shape(kind, { fill: fillAt(4), size: 2 })],
        ]),
  ];
  const period = cycle.length;
  return build(rng, {
    id,
    subtype: combined ? "Combined rules" : "Fill patterns",
    difficulty: combined ? "hard" : "medium",
    prompt: combined ? "Two rules operate at once: the shading and the orientation. Which figure comes next?" : "The shading follows a repeating pattern. Which figure comes next?",
    explanation: combined
      ? `The shading repeats every ${period} figures (${cycle.join(", ")}) and, separately, the shape turns ${Math.abs(step)}° ${step > 0 ? "clockwise" : "anticlockwise"} each time. The sixth figure has the ${fillAt(5)} shading in the orientation after five turns; each wrong option gets one of the two rules wrong.`
      : `The shading repeats every ${period} figures: ${cycle.join(", ")}. The sixth figure is therefore ${fillAt(5)}.`,
    shown,
    correct,
    candidates,
  });
}

// ---- a shape circling the frame ------------------------------------------------------------------------------------
function ringMovement(rng, id, twoShapes) {
  const kindA = rng.pick(["circle", "square", "diamond"]);
  const kindB = rng.pick(["triangle", "star", "pentagon"]);
  const stepA = rng.pick([1, 2, 3]) * (rng.next() < 0.5 ? 1 : -1);
  const stepB = -Math.sign(stepA) * rng.pick([1, 2]);
  const startA = rng.int(0, 7);
  let startB = rng.int(0, 7);
  const at = (start, step, i) => ((start + step * i) % 8 + 8) % 8;
  // Two shapes must never land on the same spot in any of the five figures.
  if (twoShapes) {
    let guard = 0;
    while ([0, 1, 2, 3, 4, 5].some((i) => at(startA, stepA, i) === at(startB, stepB, i)) && guard++ < 50) startB = rng.int(0, 7);
    if ([0, 1, 2, 3, 4, 5].some((i) => at(startA, stepA, i) === at(startB, stepB, i))) return ringMovement(rng, id, twoShapes);
  }
  const place = (pos, k, f) => shape(k, { fill: f, size: 1, x: RING[pos][0], y: RING[pos][1] });
  const cell = (a, b = null, fillA = "black", fillB = "white") => [place(a, kindA, fillA), ...(twoShapes && b !== null ? [place(b, kindB, fillB)] : [])];
  const shown = [0, 1, 2, 3].map((i) => cell(at(startA, stepA, i), at(startB, stepB, i)));
  const targetA = at(startA, stepA, 4);
  const targetB = at(startB, stepB, 4);
  const correct = cell(targetA, targetB);
  const candidates = twoShapes
    ? [
        cell(at(startA, -stepA, 4), targetB),
        cell(targetA, at(startB, -stepB, 4)),
        cell(at(startA, stepA, 5), targetB),
        cell(targetA, at(startB, stepB, 5)),
        cell(at(startA, stepA, 3), at(startB, stepB, 3)),
        cell(targetB, targetA),
        cell((targetA + 1) % 8, targetB),
        cell(targetA, (targetB + 1) % 8),
        cell((targetA + 7) % 8, (targetB + 7) % 8),
      ]
    : [
        cell(at(startA, -stepA, 4)),
        cell(at(startA, stepA, 5)),
        cell(at(startA, stepA, 3)),
        cell((targetA + 1) % 8),
        cell((targetA + 7) % 8),
        cell((targetA + 4) % 8),
        cell((targetA + 2) % 8),
        cell((targetA + 6) % 8),
        cell((targetA + 3) % 8),
      ];
  const stepWords = (step) => `${Math.abs(step)} place${Math.abs(step) === 1 ? "" : "s"} ${step > 0 ? "clockwise" : "anticlockwise"} around the frame`;
  return build(rng, {
    id,
    subtype: twoShapes ? "Combined rules" : "Movement",
    difficulty: twoShapes ? "hard" : "medium",
    prompt: twoShapes
      ? "Two shapes move around the edge of the frame, each by its own rule. Which figure comes next?"
      : "A shape moves around the edge of the frame by the same amount each time. Which figure comes next?",
    explanation: twoShapes
      ? `The ${kindA} moves ${stepWords(stepA)} each time and the ${kindB} moves ${stepWords(stepB)}. Applying both moves to the fourth figure gives the answer; each wrong option moves one of the shapes the wrong way or by the wrong amount.`
      : `The shape moves ${stepWords(stepA)} each time. Moving it once more from its position in the fourth figure gives the answer.`,
    shown,
    correct,
    candidates,
  });
}

// ---- outer shape turns, inner shape alternates ---------------------------------------------------------------------
function layered(rng, id) {
  const outer = rng.pick(["arrow", "triangle", "pentagon"]);
  const step = rng.pick([90, -90, 45, -45]);
  const start = rng.pick([0, 90, 180, 270]);
  const inner = rng.pick(["circle", "square", "diamond"]);
  const fills = rng.pick([["black", "white"], ["white", "black"], ["grey", "black"]]);
  const cell = (i, f = fills[i % 2], r = start + i * step) => [shape(outer, { fill: "white", rotate: r, size: 3 }), shape(inner, { fill: f, size: 1 })];
  const shown = [0, 1, 2, 3].map((i) => cell(i));
  const correct = cell(4);
  const otherFill = fills[0] === fills[4 % 2] ? fills[1] : fills[0];
  const candidates = [
    cell(4, otherFill),
    cell(4, fills[4 % 2], start + 4 * step + 90),
    cell(4, fills[4 % 2], start + 3 * step),
    cell(4, otherFill, start + 4 * step - step * 2),
    cell(4, otherFill, start + 4 * step + 45),
  ];
  return build(rng, {
    id,
    subtype: "Combined rules",
    difficulty: "hard",
    prompt: "The outer shape and the small inner shape each follow their own rule. Which figure comes next?",
    explanation: `The outer ${outer} turns ${Math.abs(step)}° ${step > 0 ? "clockwise" : "anticlockwise"} each time; the inner ${inner} alternates between ${fills[0]} and ${fills[1]}. The fifth figure combines both: the ${outer} after four turns with the inner shape ${fills[4 % 2]}.`,
    shown,
    correct,
    candidates,
  });
}

// ---- 3 x 3 matrix, two Latin-square rules ---------------------------------------------------------------------------
function matrix(rng, id) {
  const kinds = rng.shuffle(["circle", "square", "triangle", "diamond", "star", "pentagon"]).slice(0, 3);
  const fills = rng.shuffle(["black", "white", "grey"]);
  const [a, b] = rng.pick([[1, 1], [1, 2], [2, 1], [2, 2]]);
  const [c, d] = rng.pick([[1, 1], [1, 2], [2, 1], [2, 2]]);
  const kindAt = (r, col) => kinds[(a * r + b * col) % 3];
  const fillAt = (r, col) => fills[(c * r + d * col) % 3];
  const cell = (r, col, k = kindAt(r, col), f = fillAt(r, col)) => [shape(k, { fill: f, size: 3 })];
  const shown = [];
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) if (!(r === 2 && col === 2)) shown.push(cell(r, col));
  const correctKind = kindAt(2, 2);
  const correctFill = fillAt(2, 2);
  const correct = cell(2, 2);
  const candidates = [
    ...kinds.filter((k) => k !== correctKind).map((k) => cell(2, 2, k, correctFill)),
    ...fills.filter((f) => f !== correctFill).map((f) => cell(2, 2, correctKind, f)),
  ];
  return build(rng, {
    id,
    subtype: "Matrices",
    difficulty: "hard",
    prompt: "Each row and each column of the grid follows the same two rules. Which figure completes the grid?",
    explanation: `Every row and every column contains each of the three shapes once, and each of the three shadings once. The missing cell needs the one shape (${correctKind}) and the one shading (${correctFill}) that its row and column do not yet have. Each wrong option repeats a shape or a shading already in that row or column.`,
    shown,
    correct,
    candidates,
    layout: "grid",
    columns: 3,
  });
}

// ---- odd one out ---------------------------------------------------------------------------------------------------
function oddOneOut(rng, id, rule) {
  const oddIndex = rng.int(0, 4);
  const kinds = ["circle", "square", "triangle", "diamond", "star", "pentagon"];
  let cells;
  let explanation;
  let subtype = "Odd one out";
  if (rule === "count") {
    const n = rng.int(2, 4);
    const oddN = rng.next() < 0.5 ? n + 1 : n - 1;
    const kind = rng.pick(kinds);
    const fill = rng.pick(FILL_CHOICES);
    const make = (count) => {
      const slots = rng.shuffle(READING_ORDER).slice(0, count);
      return slots.map(([x, y]) => shape(kind, { fill, size: 1, x, y }));
    };
    cells = [0, 1, 2, 3, 4].map((i) => make(i === oddIndex ? oddN : n));
    explanation = `Four of the figures contain ${n} shapes; ${LABELS[oddIndex]} contains ${oddN}. The positions of the shapes are irrelevant.`;
  } else {
    const make = (mixed) => {
      const slots = rng.shuffle(READING_ORDER).slice(0, 3);
      const uniform = rng.pick(["black", "white"]);
      const fills = mixed ? ["black", "white", rng.pick(["black", "white"])] : [uniform, uniform, uniform];
      // a mixed cell must really be mixed
      if (mixed && fills.every((f) => f === fills[0])) fills[2] = fills[0] === "black" ? "white" : "black";
      return slots.map(([x, y], i) => shape(rng.pick(kinds), { fill: fills[i], size: 1, x, y }));
    };
    cells = [0, 1, 2, 3, 4].map((i) => make(i === oddIndex));
    explanation = `In four of the figures every shape has the same shading (which shading varies from figure to figure); ${LABELS[oddIndex]} mixes black and white shapes.`;
    subtype = "Odd one out";
  }
  return {
    id,
    subtype,
    difficulty: rule === "count" ? "easy" : "medium",
    prompt: "The five figures are labelled A to E from left to right. Four of them follow the same rule; one does not. Which is the odd one out?",
    options: LABELS,
    optionFigures: null,
    correct: LABELS[oddIndex],
    explanation,
    exhibit: { kind: "shapes", layout: "row", cells },
  };
}

export function generateDiagrammatic() {
  const rng = makeRng(20260925);
  const q = [];
  let n = 0;
  const id = (pack) => `${pack}-${String(++n).padStart(2, "0")}`;

  // sequences-and-patterns (joins the three text-sequence questions already in that pack)
  for (let i = 0; i < 2; i++) q.push({ pack: "sequences-and-patterns", ...rotationSequence(rng, id("seq")) });
  for (let i = 0; i < 2; i++) q.push({ pack: "sequences-and-patterns", ...countSequence(rng, id("seq")) });
  q.push({ pack: "sequences-and-patterns", ...sizeCycle(rng, id("seq")) });

  // shape-transformations
  for (let i = 0; i < 3; i++) q.push({ pack: "shape-transformations", ...fillCycle(rng, id("tr"), false) });
  for (let i = 0; i < 2; i++) q.push({ pack: "shape-transformations", ...fillCycle(rng, id("tr"), true) });
  for (let i = 0; i < 3; i++) q.push({ pack: "shape-transformations", ...layered(rng, id("tr")) });
  for (let i = 0; i < 2; i++) q.push({ pack: "shape-transformations", ...rotationSequence(rng, id("tr")) });

  // movement-patterns
  for (let i = 0; i < 4; i++) q.push({ pack: "movement-patterns", ...ringMovement(rng, id("mv"), false) });
  for (let i = 0; i < 3; i++) q.push({ pack: "movement-patterns", ...ringMovement(rng, id("mv"), true) });
  for (let i = 0; i < 2; i++) q.push({ pack: "movement-patterns", ...countSequence(rng, id("mv")) });
  q.push({ pack: "movement-patterns", ...sizeCycle(rng, id("mv")) });

  // matrices-and-odd-one-out
  for (let i = 0; i < 5; i++) q.push({ pack: "matrices-and-odd-one-out", ...matrix(rng, id("mx")) });
  for (let i = 0; i < 3; i++) q.push({ pack: "matrices-and-odd-one-out", ...oddOneOut(rng, id("mx"), "count") });
  for (let i = 0; i < 2; i++) q.push({ pack: "matrices-and-odd-one-out", ...oddOneOut(rng, id("mx"), "fill") });

  return q;
}
