/**
 * reference/auth/create-cv.png's "BUILD PROGRESS" bar + percentage —
 * a real completeness signal computed by the page from the CV's actual
 * data (see computeBuildProgress in page.tsx), not a decorative
 * placeholder.
 */
export function BuildProgress({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Build progress</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <p className="shrink-0 text-2xl font-bold text-primary">
        {percent}
        <span className="text-base">%</span>
      </p>
    </div>
  );
}
