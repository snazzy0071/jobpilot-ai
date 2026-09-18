import type { SubtypeHeatmapCell } from "@/lib/test-prep/analytics";

const DIFFICULTY_ORDER = ["easy", "medium", "hard", "unspecified"] as const;
const DIFFICULTY_LABELS: Record<(typeof DIFFICULTY_ORDER)[number], string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  unspecified: "Untagged",
};

function toneFor(accuracy: number): string {
  if (accuracy < 50) return "bg-destructive/15 text-destructive";
  if (accuracy < 70) return "bg-warning/15 text-warning";
  return "bg-success/15 text-success";
}

/**
 * Subtype × difficulty accuracy grid across every answer this user has
 * ever submitted (src/lib/test-prep/analytics.ts's own aggregate, not a
 * single session's) — a weak-subtype cell is what a "personalized
 * study plan" recommendation is actually built from, this is the same
 * data shown at the granularity that makes the weak spot visible.
 * Colour is a three-way status bucket (weak/borderline/strong), reusing
 * this app's existing destructive/warning/success tokens, plus the
 * number itself is always printed — never colour alone.
 */
export function SubtypeHeatmap({ cells }: { cells: SubtypeHeatmapCell[] }) {
  if (cells.length === 0) {
    return <p className="text-sm text-muted-foreground">Answer a few questions to see your strengths and weak spots by topic.</p>;
  }

  const subtypes = Array.from(new Set(cells.map((cell) => cell.subtype))).sort((a, b) => a.localeCompare(b));
  const difficultiesPresent = DIFFICULTY_ORDER.filter((difficulty) => cells.some((cell) => cell.difficulty === difficulty));
  const byKey = new Map(cells.map((cell) => [`${cell.subtype}::${cell.difficulty}`, cell]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-muted-foreground">Topic</th>
            {difficultiesPresent.map((difficulty) => (
              <th key={difficulty} className="px-2 text-xs font-medium text-muted-foreground">
                {DIFFICULTY_LABELS[difficulty]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subtypes.map((subtype) => (
            <tr key={subtype}>
              <td className="py-1 pr-2 font-medium">{subtype}</td>
              {difficultiesPresent.map((difficulty) => {
                const cell = byKey.get(`${subtype}::${difficulty}`);
                if (!cell) {
                  return <td key={difficulty} className="rounded-md bg-muted/30 p-2 text-center text-xs text-muted-foreground">—</td>;
                }
                return (
                  <td key={difficulty} className={`rounded-md p-2 text-center text-xs font-semibold ${toneFor(cell.accuracy)}`}>
                    {cell.accuracy}%
                    <span className="block text-[10px] font-normal opacity-80">
                      {cell.correct}/{cell.total}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
