import { useId } from "react";
import {
  describeCell,
  describeExhibit,
  type BarChartExhibit,
  type Exhibit,
  type FigureCell,
  type FigureShape,
  type ShapesExhibit,
  type TableExhibit,
} from "@/lib/test-prep/exhibit";

// Draws a question's exhibit: a table, a bar chart, or a set of shapes. Every drawing carries a text description as its
// accessible name (src/lib/test-prep/exhibit.ts), and the bar chart also ships its numbers as a table for assistive tech.
// Shapes use the theme's own foreground/background so they work in light and dark mode.

const RADIUS = { 1: 12, 2: 19, 3: 28 } as const;
const OFFSET = 27; // how far a shape moves from the centre for x/y = ±1

type Point = [number, number];

function regularPolygon(sides: number, radius: number, startDegrees = -90): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = ((startDegrees + (360 / sides) * index) * Math.PI) / 180;
    return [radius * Math.cos(angle), radius * Math.sin(angle)] as Point;
  });
}

function starPoints(radius: number): Point[] {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = ((-90 + 36 * index) * Math.PI) / 180;
    const r = index % 2 === 0 ? radius : radius * 0.45;
    return [r * Math.cos(angle), r * Math.sin(angle)] as Point;
  });
}

function crossPoints(radius: number): Point[] {
  const a = radius * 0.34;
  const r = radius;
  return [
    [-a, -r], [a, -r], [a, -a], [r, -a], [r, a], [a, a], [a, r], [-a, r], [-a, a], [-r, a], [-r, -a], [-a, -a],
  ];
}

function arrowPoints(radius: number): Point[] {
  const r = radius;
  return [
    [0, -r], [r * 0.85, -r * 0.05], [r * 0.32, -r * 0.05], [r * 0.32, r], [-r * 0.32, r], [-r * 0.32, -r * 0.05], [-r * 0.85, -r * 0.05],
  ];
}

function points(shape: FigureShape): Point[] | null {
  const r = RADIUS[shape.size];
  switch (shape.kind) {
    case "triangle":
      return regularPolygon(3, r * 1.15);
    case "square":
      return regularPolygon(4, r * 1.28, -45);
    case "diamond":
      return regularPolygon(4, r * 1.3, -90);
    case "pentagon":
      return regularPolygon(5, r * 1.1);
    case "hexagon":
      return regularPolygon(6, r * 1.1, 0);
    case "star":
      return starPoints(r * 1.25);
    case "cross":
      return crossPoints(r);
    case "arrow":
      return arrowPoints(r * 1.1);
    default:
      return null; // circle / dot are drawn as circles
  }
}

function fillClass(fill: FigureShape["fill"], patternId: string): { className: string; fill?: string } {
  switch (fill) {
    case "black":
      return { className: "fill-foreground stroke-foreground" };
    case "grey":
      return { className: "fill-foreground/35 stroke-foreground" };
    case "hatch":
      return { className: "stroke-foreground", fill: `url(#${patternId})` };
    default:
      return { className: "fill-background stroke-foreground" };
  }
}

function ShapeGlyph({ shape, patternId }: { shape: FigureShape; patternId: string }) {
  const cx = 50 + shape.x * OFFSET;
  const cy = 50 + shape.y * OFFSET;
  const { className, fill } = fillClass(shape.fill, patternId);
  const common = { className, fill, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  const pts = points(shape);
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${shape.rotate})`}>
      {pts ? (
        <polygon points={pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")} {...common} />
      ) : (
        <circle r={shape.kind === "dot" ? 5 : RADIUS[shape.size]} {...common} />
      )}
    </g>
  );
}

/** One cell of a figure — also used, at a smaller size, for each answer option of a diagrammatic question. */
export function FigureCellView({ cell, className = "size-24" }: { cell: FigureCell | null; className?: string }) {
  const patternId = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={describeCell(cell)} className={`shrink-0 rounded-md border bg-background text-foreground ${className}`}>
      <defs>
        <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" className="fill-background" />
          <line x1="0" y1="0" x2="0" y2="7" strokeWidth="3" className="stroke-foreground" />
        </pattern>
      </defs>
      {cell === null ? (
        <text x="50" y="62" textAnchor="middle" fontSize="44" className="fill-muted-foreground" fontWeight="600">
          ?
        </text>
      ) : (
        cell.map((shape, index) => <ShapeGlyph key={index} shape={shape} patternId={patternId} />)
      )}
    </svg>
  );
}

function ShapesView({ exhibit }: { exhibit: ShapesExhibit }) {
  return (
    <div
      role="group"
      aria-label={describeExhibit(exhibit)}
      className={exhibit.layout === "grid" ? "grid w-fit gap-2" : "flex flex-wrap items-center gap-2"}
      style={exhibit.layout === "grid" ? { gridTemplateColumns: `repeat(${exhibit.columns ?? 3}, minmax(0, auto))` } : undefined}
      data-testid="exhibit-shapes"
    >
      {exhibit.cells.map((cell, index) => (
        <FigureCellView key={index} cell={cell} className={exhibit.layout === "grid" ? "size-20 sm:size-24" : "size-16 sm:size-20"} />
      ))}
    </div>
  );
}

function TableView({ exhibit }: { exhibit: TableExhibit }) {
  return (
    <div className="overflow-x-auto" data-testid="exhibit-table">
      <table className="w-full min-w-[20rem] border-collapse text-sm">
        {exhibit.caption && <caption className="pb-2 text-left text-sm font-medium">{exhibit.caption}</caption>}
        <thead>
          <tr>
            {exhibit.headers.map((header, index) => (
              <th key={index} scope="col" className="border-b bg-muted/40 px-3 py-2 text-left font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exhibit.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row" className="border-b px-3 py-2 text-left font-medium">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex} className="border-b px-3 py-2 tabular-nums">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {exhibit.note && <p className="mt-2 text-xs text-muted-foreground">{exhibit.note}</p>}
    </div>
  );
}

const SERIES_CLASSES = ["fill-primary", "fill-foreground/55", "fill-foreground/25"];

function niceMax(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

function BarChartView({ exhibit }: { exhibit: BarChartExhibit }) {
  const width = 480;
  const height = 240;
  const margin = { top: 16, right: 12, bottom: 44, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const max = niceMax(Math.max(...exhibit.series.flatMap((series) => series.values)));
  const groupWidth = plotWidth / exhibit.categories.length;
  const barWidth = Math.min(36, (groupWidth * 0.8) / exhibit.series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * max);

  return (
    <figure className="flex flex-col gap-2" data-testid="exhibit-bar-chart">
      {exhibit.caption && <figcaption className="text-sm font-medium">{exhibit.caption}</figcaption>}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={describeExhibit(exhibit)} className="w-full max-w-xl text-foreground">
        {ticks.map((tick) => {
          const y = margin.top + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={tick}>
              <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} className="stroke-border" strokeWidth="1" />
              <text x={margin.left - 6} y={y + 4} textAnchor="end" fontSize="11" className="fill-muted-foreground">
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </text>
            </g>
          );
        })}
        {exhibit.categories.map((category, categoryIndex) => {
          const groupX = margin.left + groupWidth * categoryIndex + (groupWidth - barWidth * exhibit.series.length) / 2;
          return (
            <g key={category}>
              {exhibit.series.map((series, seriesIndex) => {
                const value = series.values[categoryIndex];
                const barHeight = (value / max) * plotHeight;
                return (
                  <rect
                    key={series.name}
                    x={groupX + barWidth * seriesIndex}
                    y={margin.top + plotHeight - barHeight}
                    width={barWidth - 3}
                    height={barHeight}
                    rx="2"
                    className={SERIES_CLASSES[seriesIndex] ?? SERIES_CLASSES[2]}
                  />
                );
              })}
              <text x={margin.left + groupWidth * categoryIndex + groupWidth / 2} y={height - margin.bottom + 18} textAnchor="middle" fontSize="12" className="fill-foreground">
                {category}
              </text>
            </g>
          );
        })}
        {exhibit.unit && (
          <text x={margin.left} y={10} fontSize="11" className="fill-muted-foreground">
            {exhibit.unit}
          </text>
        )}
      </svg>
      {exhibit.series.length > 1 && (
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-hidden="true">
          {exhibit.series.map((series, index) => (
            <li key={series.name} className="flex items-center gap-1.5">
              <span className={`inline-block size-3 rounded-sm ${(SERIES_CLASSES[index] ?? SERIES_CLASSES[2]).replace("fill-", "bg-")}`} /> {series.name}
            </li>
          ))}
        </ul>
      )}
      <table className="sr-only">
        <caption>{exhibit.caption ?? "Chart data"}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            {exhibit.series.map((series) => (
              <th key={series.name} scope="col">
                {series.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {exhibit.categories.map((category, index) => (
            <tr key={category}>
              <th scope="row">{category}</th>
              {exhibit.series.map((series) => (
                <td key={series.name}>{series.values[index]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function ExhibitView({ exhibit }: { exhibit: Exhibit }) {
  switch (exhibit.kind) {
    case "shapes":
      return <ShapesView exhibit={exhibit} />;
    case "table":
      return <TableView exhibit={exhibit} />;
    case "bar_chart":
      return <BarChartView exhibit={exhibit} />;
  }
}
