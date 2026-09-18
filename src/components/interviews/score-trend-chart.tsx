const WIDTH = 640;
const HEIGHT = 220;
const PAD_X = 40;
const PAD_Y = 24;

const GRID_VALUES = [0, 25, 50, 75, 100];

/**
 * A small hand-rolled SVG line chart — same "no charting library" call
 * as CompetencyRadarChart, for the same reason: one line and a handful
 * of dots is the entire feature this needs. Needs at least 2 points to
 * show a real trend; a single completed session has nothing to compare
 * against yet.
 */
export function ScoreTrendChart({ points }: { points: { label: string; score: number }[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">Complete at least 2 interviews to see a trend here.</p>;
  }

  const stepX = points.length > 1 ? (WIDTH - PAD_X * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => ({
    x: PAD_X + index * stepX,
    y: PAD_Y + (1 - point.score / 100) * (HEIGHT - PAD_Y * 2),
  }));
  const linePath = coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Overall score trend">
      {GRID_VALUES.map((value) => {
        const y = PAD_Y + (1 - value / 100) * (HEIGHT - PAD_Y * 2);
        return (
          <g key={value}>
            <line x1={PAD_X} y1={y} x2={WIDTH - PAD_X} y2={y} className="stroke-border" />
            <text x={PAD_X - 8} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
              {value}
            </text>
          </g>
        );
      })}

      <path d={linePath} className="fill-none stroke-primary" strokeWidth={2} />
      {coords.map((coord, index) => (
        <circle key={index} cx={coord.x} cy={coord.y} r={4} className="fill-primary" />
      ))}

      {points.map((point, index) => (
        <text
          key={index}
          x={coords[index].x}
          y={HEIGHT - 4}
          textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
          className="fill-muted-foreground text-[9px]"
        >
          {point.label}
        </text>
      ))}
    </svg>
  );
}
