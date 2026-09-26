function scoreStroke(score: number): string {
  if (score >= 80) return "stroke-success";
  if (score >= 50) return "stroke-warning";
  return "stroke-destructive";
}

function scoreText(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

/** reference/auth/ats-scanner.png's circular score gauge — a plain SVG ring, no charting library needed for one arc. */
export function ScoreRing({ score, size = 88 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    // role="img" + aria-label: the ring itself is decorative (colour and arc length), and the bare "50" inside it
    // reads ambiguously without "out of 100" for anyone not seeing the ring's visual context, screen reader or not.
    <div
      role="img"
      aria-label={`Score: ${score} out of 100`}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-muted" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          className={scoreStroke(score)}
        />
      </svg>
      <span aria-hidden className={`absolute font-heading text-2xl font-bold ${scoreText(score)}`}>
        {score}
      </span>
    </div>
  );
}
