import { describe, expect, it } from "vitest";
import { describeCell, describeExhibit, exhibitSchema, figureCellSchema, optionFiguresSchema, visuallyIdentical } from "@/lib/test-prep/exhibit";

const cell = (input: unknown[]) => figureCellSchema.parse(input);

describe("exhibitSchema", () => {
  it("rejects tables whose rows don't match the headers", () => {
    expect(exhibitSchema.safeParse({ kind: "table", headers: ["a", "b"], rows: [["1", "2", "3"]] }).success).toBe(false);
  });

  it("rejects bar-chart series that don't match the categories", () => {
    expect(exhibitSchema.safeParse({ kind: "bar_chart", categories: ["A", "B"], series: [{ name: "s", values: [1] }] }).success).toBe(false);
    expect(exhibitSchema.safeParse({ kind: "bar_chart", categories: ["A", "B"], series: [{ name: "s", values: [1, 2] }] }).success).toBe(true);
  });

  it("needs columns for a grid and a 45-degree rotation step", () => {
    const cells = [[{ kind: "circle" }], null];
    expect(exhibitSchema.safeParse({ kind: "shapes", layout: "grid", cells }).success).toBe(false);
    expect(exhibitSchema.safeParse({ kind: "shapes", layout: "grid", columns: 2, cells }).success).toBe(true);
    expect(figureCellSchema.safeParse([{ kind: "square", rotate: 30 }]).success).toBe(false);
  });

  it("rejects unknown kinds", () => {
    expect(exhibitSchema.safeParse({ kind: "video" }).success).toBe(false);
  });
});

describe("optionFiguresSchema", () => {
  it("needs between two and eight figures", () => {
    expect(optionFiguresSchema.safeParse([[]]).success).toBe(false);
    expect(optionFiguresSchema.safeParse([[], []]).success).toBe(true);
  });
});

describe("text descriptions", () => {
  it("describes a shape with size, fill, rotation and position", () => {
    expect(describeCell(cell([{ kind: "triangle", fill: "black", rotate: 90, size: 3, x: 1, y: -1 }]))).toBe("large black triangle, rotated 90 degrees clockwise, top right");
  });

  it("does not mention rotation for a circle", () => {
    expect(describeCell(cell([{ kind: "circle", rotate: 90 }]))).toBe("medium white circle");
  });

  it("describes missing and empty cells", () => {
    expect(describeCell(null)).toBe("the missing figure");
    expect(describeCell([])).toBe("an empty cell");
  });

  it("describes a table and a chart with their data", () => {
    const table = exhibitSchema.parse({ kind: "table", caption: "Sales", headers: ["Region", "£"], rows: [["N", "10"], ["S", "20"]] });
    expect(describeExhibit(table)).toBe("Sales. Columns: Region, £. N, 10; S, 20.");
    const chart = exhibitSchema.parse({ kind: "bar_chart", unit: "units", categories: ["Q1", "Q2"], series: [{ name: "2025", values: [3, 4] }] });
    expect(describeExhibit(chart)).toBe("Bar chart (units). 2025: Q1 3, Q2 4.");
  });
});

describe("visuallyIdentical", () => {
  it("treats a rotated circle or square as the same figure", () => {
    expect(visuallyIdentical(cell([{ kind: "circle", rotate: 0 }]), cell([{ kind: "circle", rotate: 90 }]))).toBe(true);
    expect(visuallyIdentical(cell([{ kind: "square", rotate: 0 }]), cell([{ kind: "square", rotate: 90 }]))).toBe(true);
  });

  it("tells a rotated triangle apart", () => {
    expect(visuallyIdentical(cell([{ kind: "triangle", rotate: 0 }]), cell([{ kind: "triangle", rotate: 90 }]))).toBe(false);
  });

  it("tells fills and sizes apart, and ignores drawing order", () => {
    expect(visuallyIdentical(cell([{ kind: "star", fill: "black" }]), cell([{ kind: "star", fill: "white" }]))).toBe(false);
    const a = cell([{ kind: "star", x: -1 }, { kind: "cross", x: 1 }]);
    const b = cell([{ kind: "cross", x: 1 }, { kind: "star", x: -1 }]);
    expect(visuallyIdentical(a, b)).toBe(true);
  });
});
