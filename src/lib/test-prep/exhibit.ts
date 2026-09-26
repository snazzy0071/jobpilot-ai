// The visual part of a question: a table or bar chart (numerical reasoning) or a set of shapes (diagrammatic reasoning).
// Stored as JSON on questions.exhibit / questions.option_figures and rendered by src/components/test-prep/exhibit-view.tsx.
// Pure and client-safe: this file is shared by the renderer, the admin form's validation and the content tests.
//
// Everything here also has a TEXT description (describeExhibit / describeCell), used as the accessible name of the SVG,
// so a screen-reader user gets the same information as a sighted one (a diagrammatic question is not a picture to a
// screen reader; it is "a large black triangle, rotated 90 degrees, then ...").

import { z } from "zod";

export const SHAPE_KINDS = ["circle", "square", "triangle", "diamond", "star", "cross", "pentagon", "hexagon", "arrow", "dot"] as const;
export type ShapeKind = (typeof SHAPE_KINDS)[number];

export const FILLS = ["black", "white", "grey", "hatch"] as const;
export type Fill = (typeof FILLS)[number];

/** 1 = small, 2 = medium, 3 = large. */
export const SIZES = [1, 2, 3] as const;

export const figureShapeSchema = z.object({
  kind: z.enum(SHAPE_KINDS),
  fill: z.enum(FILLS).default("white"),
  /** Degrees clockwise, in steps of 45. */
  rotate: z
    .number()
    .int()
    .min(0)
    .max(315)
    .refine((value) => value % 45 === 0, "Rotation must be a multiple of 45 degrees.")
    .default(0),
  size: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  /** Position inside the cell on a 3x3 grid: -1 (left/top), 0 (centre), 1 (right/bottom). */
  x: z.union([z.literal(-1), z.literal(0), z.literal(1)]).default(0),
  y: z.union([z.literal(-1), z.literal(0), z.literal(1)]).default(0),
});
export type FigureShape = z.infer<typeof figureShapeSchema>;
export type FigureShapeInput = z.input<typeof figureShapeSchema>;

/** One cell: the shapes drawn in it (an empty list is a blank cell). */
export const figureCellSchema = z.array(figureShapeSchema).max(9);
export type FigureCell = z.infer<typeof figureCellSchema>;

const shapesExhibitSchema = z.object({
  kind: z.literal("shapes"),
  layout: z.enum(["row", "grid"]),
  /** Grid only: cells per row. */
  columns: z.number().int().min(2).max(4).optional(),
  /** A null cell is the missing one, drawn as "?". */
  cells: z.array(figureCellSchema.nullable()).min(2).max(12),
  caption: z.string().max(200).optional(),
});

const tableExhibitSchema = z.object({
  kind: z.literal("table"),
  caption: z.string().max(200).optional(),
  headers: z.array(z.string().max(60)).min(2).max(8),
  rows: z.array(z.array(z.string().max(60)).min(1).max(8)).min(1).max(12),
  note: z.string().max(300).optional(),
});

const barChartExhibitSchema = z.object({
  kind: z.literal("bar_chart"),
  caption: z.string().max(200).optional(),
  unit: z.string().max(30).optional(),
  categories: z.array(z.string().max(30)).min(2).max(8),
  series: z
    .array(z.object({ name: z.string().max(40), values: z.array(z.number().finite().min(0)).min(2).max(8) }))
    .min(1)
    .max(3),
});

export const exhibitSchema = z
  .discriminatedUnion("kind", [shapesExhibitSchema, tableExhibitSchema, barChartExhibitSchema])
  .superRefine((exhibit, ctx) => {
    if (exhibit.kind === "table") {
      for (const [index, row] of exhibit.rows.entries()) {
        if (row.length !== exhibit.headers.length) {
          ctx.addIssue({ code: "custom", message: `Row ${index + 1} has ${row.length} cells but there are ${exhibit.headers.length} headers.` });
        }
      }
    }
    if (exhibit.kind === "bar_chart") {
      for (const series of exhibit.series) {
        if (series.values.length !== exhibit.categories.length) {
          ctx.addIssue({ code: "custom", message: `Series "${series.name}" has ${series.values.length} values for ${exhibit.categories.length} categories.` });
        }
      }
    }
    if (exhibit.kind === "shapes" && exhibit.layout === "grid" && !exhibit.columns) {
      ctx.addIssue({ code: "custom", message: "A grid needs a column count." });
    }
  });
export type Exhibit = z.infer<typeof exhibitSchema>;
export type ShapesExhibit = Extract<Exhibit, { kind: "shapes" }>;
export type TableExhibit = Extract<Exhibit, { kind: "table" }>;
export type BarChartExhibit = Extract<Exhibit, { kind: "bar_chart" }>;

/** One figure per option (a diagrammatic answer is a picture). */
export const optionFiguresSchema = z.array(figureCellSchema).min(2).max(8);
export type OptionFigures = z.infer<typeof optionFiguresSchema>;

// ---- text descriptions -------------------------------------------------------------------------------------------

const SIZE_WORDS = { 1: "small", 2: "medium", 3: "large" } as const;
const FILL_WORDS: Record<Fill, string> = { black: "black", white: "white", grey: "grey", hatch: "striped" };
const POSITION_WORDS: Record<string, string> = {
  "-1,-1": "top left", "0,-1": "top", "1,-1": "top right",
  "-1,0": "left", "0,0": "centre", "1,0": "right",
  "-1,1": "bottom left", "0,1": "bottom", "1,1": "bottom right",
};
/** Shapes with no visible orientation (a circle, a dot) never mention a rotation. */
const ROTATIONALLY_SYMMETRIC: ShapeKind[] = ["circle", "dot"];

export function describeShape(shape: FigureShape): string {
  const parts = [SIZE_WORDS[shape.size], FILL_WORDS[shape.fill], shape.kind];
  const text = parts.join(" ");
  const rotation = shape.rotate !== 0 && !ROTATIONALLY_SYMMETRIC.includes(shape.kind) ? `, rotated ${shape.rotate} degrees clockwise` : "";
  const position = shape.x !== 0 || shape.y !== 0 ? `, ${POSITION_WORDS[`${shape.x},${shape.y}`]}` : "";
  return `${text}${rotation}${position}`;
}

export function describeCell(cell: FigureCell | null): string {
  if (cell === null) return "the missing figure";
  if (cell.length === 0) return "an empty cell";
  return cell.map(describeShape).join(" with a ");
}

export function describeExhibit(exhibit: Exhibit): string {
  switch (exhibit.kind) {
    case "shapes":
      return `${exhibit.caption ? `${exhibit.caption}. ` : ""}${exhibit.cells.map((cell, index) => `Figure ${index + 1}: ${describeCell(cell)}`).join(". ")}.`;
    case "table":
      return `${exhibit.caption ?? "Table"}. Columns: ${exhibit.headers.join(", ")}. ${exhibit.rows.map((row) => row.join(", ")).join("; ")}.`;
    case "bar_chart":
      return `${exhibit.caption ?? "Bar chart"}${exhibit.unit ? ` (${exhibit.unit})` : ""}. ${exhibit.series
        .map((series) => `${series.name}: ${series.values.map((value, i) => `${exhibit.categories[i]} ${value}`).join(", ")}`)
        .join(". ")}.`;
  }
}

/** A stable string for a cell, for comparing figures (are two options identical?). Order of shapes matters. */
export function canonicalCell(cell: FigureCell): string {
  return JSON.stringify(cell.map((shape) => [shape.kind, shape.fill, shape.rotate, shape.size, shape.x, shape.y]));
}

/**
 * Whether two cells would look the same to a person: a circle turned 90 degrees is the same circle, and a shape drawn
 * twice is not a different figure from once. Used to make sure a question's options are visually distinct.
 */
export function visuallyIdentical(a: FigureCell, b: FigureCell): boolean {
  const normalise = (cell: FigureCell) =>
    JSON.stringify(
      cell
        .map((shape) => [shape.kind, shape.fill, ROTATIONALLY_SYMMETRIC.includes(shape.kind) ? 0 : shape.rotate % symmetry(shape.kind), shape.size, shape.x, shape.y])
        .sort(),
    );
  return normalise(a) === normalise(b);
}

/** Degrees after which a shape looks the same again. */
function symmetry(kind: ShapeKind): number {
  switch (kind) {
    case "square":
    case "cross":
      return 90;
    case "diamond":
      return 180;
    case "hexagon":
      return 180; // a hexagon repeats every 60 degrees; among 45-degree steps, 180 is the period that matters
    case "circle":
    case "dot":
      return 360;
    default:
      return 360;
  }
}
