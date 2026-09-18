import { INTERVIEW_COMPETENCY_LABELS, type InterviewCompetencyBreakdownEntry } from "@/lib/interviews/types";

// Deliberately wider than tall — the plot itself is circular, but
// competency labels ("Time Management", "Customer Focus", ...) need
// real horizontal room on both sides or they clip past the SVG's
// viewBox edge (confirmed by an actual rendered screenshot during
// this task, not assumed — the first version of this chart did clip).
const VIEW_WIDTH = 600;
const VIEW_HEIGHT = 320;
const CENTER_X = VIEW_WIDTH / 2;
const CENTER_Y = VIEW_HEIGHT / 2;
const MAX_RADIUS = 85;
const LABEL_RADIUS = MAX_RADIUS + 30;

function pointAt(index: number, count: number, radius: number): { x: number; y: number } {
  // Start at the top (12 o'clock) and go clockwise, same convention as a clock face.
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return { x: CENTER_X + radius * Math.cos(angle), y: CENTER_Y + radius * Math.sin(angle) };
}

/** Text anchors so a label never overlaps the axis it belongs to — right side left-aligned, left side right-aligned, top/bottom centered. */
function labelAnchor(x: number): "start" | "end" | "middle" {
  if (Math.abs(x - CENTER_X) < 8) return "middle";
  return x > CENTER_X ? "start" : "end";
}

const GRID_RINGS = [0.25, 0.5, 0.75, 1];

/**
 * A small hand-rolled SVG radar chart — no charting library, since a
 * handful of straight-line polygons is the entire feature this needs
 * and this codebase already prefers lightweight hand-built visuals
 * (MetricBar) over pulling in a dependency for one shape. Needs at
 * least 3 axes to read as a sensible polygon; a session with fewer
 * distinct competencies scored falls back to a plain list instead of a
 * degenerate 1-2-point "chart".
 */
export function CompetencyRadarChart({ data }: { data: InterviewCompetencyBreakdownEntry[] }) {
  const count = data.length;

  if (count < 3) {
    return (
      <ul className="flex flex-col gap-1 text-sm">
        {data.map((entry) => (
          <li key={entry.competency} className="flex items-center justify-between">
            <span>{INTERVIEW_COMPETENCY_LABELS[entry.competency]}</span>
            <span className="font-medium">{entry.score}/100</span>
          </li>
        ))}
      </ul>
    );
  }

  const polygonPoints = data.map((entry, index) => pointAt(index, count, (entry.score / 100) * MAX_RADIUS));
  const polygonPath = polygonPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      className="mx-auto w-full max-w-lg"
      role="img"
      aria-label="Competency scores"
    >
      {GRID_RINGS.map((fraction) => {
        const ringPoints = data.map((_, index) => pointAt(index, count, fraction * MAX_RADIUS));
        return (
          <polygon
            key={fraction}
            points={ringPoints.map((point) => `${point.x},${point.y}`).join(" ")}
            className="fill-none stroke-border"
          />
        );
      })}

      {data.map((entry, index) => {
        const axisEnd = pointAt(index, count, MAX_RADIUS);
        return (
          <line key={entry.competency} x1={CENTER_X} y1={CENTER_Y} x2={axisEnd.x} y2={axisEnd.y} className="stroke-border" />
        );
      })}

      <polygon points={polygonPath} className="fill-primary/25 stroke-primary" strokeWidth={2} />
      {polygonPoints.map((point, index) => (
        <circle key={data[index].competency} cx={point.x} cy={point.y} r={3} className="fill-primary" />
      ))}

      {data.map((entry, index) => {
        const labelPoint = pointAt(index, count, LABEL_RADIUS);
        return (
          <text
            key={entry.competency}
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor={labelAnchor(labelPoint.x)}
            className="fill-foreground text-[11px]"
          >
            {INTERVIEW_COMPETENCY_LABELS[entry.competency]} ({entry.score})
          </text>
        );
      })}
    </svg>
  );
}
