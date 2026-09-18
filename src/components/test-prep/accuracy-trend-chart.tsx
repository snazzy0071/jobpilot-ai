const WIDTH = 640;
const HEIGHT = 220;
const PAD_X = 40;
const PAD_Y = 24;

const GRID_VALUES = [0, 25, 50, 75, 100];

export type AccuracyTrendPoint = { label: string; score: number; accuracy: number };

/**
 * Same hand-rolled SVG line-chart approach as the interview coach's
 * ScoreTrendChart (no charting library in this app) — extended to two
 * series instead of one, since score and accuracy are genuinely
 * different numbers here (score counts a skipped question against you,
 * accuracy doesn't — src/lib/test-prep/analytics.ts's own comment).
 * Two series means a real legend, not just colour, per this app's own
 * accessibility bar.
 */
export function AccuracyTrendChart({ points }: { points: AccuracyTrendPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-muted-foreground">Complete at least 2 practice sessions to see a trend here.</p>;
  }

  const stepX = (WIDTH - PAD_X * 2) / (points.length - 1);
  const yFor = (value: number) => PAD_Y + (1 - value / 100) * (HEIGHT - PAD_Y * 2);

  const scoreCoords = points.map((point, index) => ({ x: PAD_X + index * stepX, y: yFor(point.score) }));
  const accuracyCoords = points.map((point, index) => ({ x: PAD_X + index * stepX, y: yFor(point.accuracy) }));
  const pathFor = (coords: { x: number; y: number }[]) => coords.map((coord, index) => `${index === 0 ? "M" : "L"} ${coord.x} ${coord.y}`).join(" ");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" /> Score
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chart-2" /> Accuracy
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Score and accuracy trend across your practice sessions">
        {GRID_VALUES.map((value) => (
          <g key={value}>
            <line x1={PAD_X} y1={yFor(value)} x2={WIDTH - PAD_X} y2={yFor(value)} className="stroke-border" />
            <text x={PAD_X - 8} y={yFor(value) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
              {value}
            </text>
          </g>
        ))}

        <path d={pathFor(accuracyCoords)} className="fill-none stroke-chart-2" strokeWidth={2} />
        {accuracyCoords.map((coord, index) => (
          <circle key={index} cx={coord.x} cy={coord.y} r={3} className="fill-chart-2" />
        ))}

        <path d={pathFor(scoreCoords)} className="fill-none stroke-primary" strokeWidth={2} />
        {scoreCoords.map((coord, index) => (
          <circle key={index} cx={coord.x} cy={coord.y} r={3.5} className="fill-primary" />
        ))}

        {points.map((point, index) => (
          <text
            key={index}
            x={scoreCoords[index].x}
            y={HEIGHT - 4}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground text-[9px]"
          >
            {point.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
