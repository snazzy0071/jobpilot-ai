import { Card } from "@/components/ui/card";
import { SPONSOR_RATINGS, SPONSOR_RATING_LABELS, type SponsorStatistics } from "@/lib/sponsors/types";

function StatBar({ label, count, total }: { label: string; count: number; total: number }) {
  const width = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{count.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

/**
 * Real numbers only — src/lib/sponsors/queries.ts's getSponsorStatistics,
 * backed by migration 0055's views. Grouped strictly by columns that
 * exist (rating, route); no region/nation/sector breakdown, since the
 * register has no such column (see that migration's own doc comment).
 */
export function SponsorStatisticsBreakdown({ statistics }: { statistics: SponsorStatistics }) {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 sm:grid-cols-2">
      <Card className="gap-4 p-6">
        <p className="text-sm font-medium">Sponsors by rating</p>
        <div className="flex flex-col gap-3">
          {SPONSOR_RATINGS.map((rating) => (
            <StatBar
              key={rating}
              label={SPONSOR_RATING_LABELS[rating]}
              count={statistics.byRating[rating]}
              total={statistics.totalActive}
            />
          ))}
        </div>
      </Card>

      <Card className="gap-4 p-6">
        <p className="text-sm font-medium">Top visa routes</p>
        {statistics.topRoutes.length > 0 ? (
          <div className="flex flex-col gap-3">
            {statistics.topRoutes.map((route) => (
              <StatBar
                key={route.route}
                label={route.route}
                count={route.count}
                total={statistics.topRoutes[0].count}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No route data yet.</p>
        )}
      </Card>
    </div>
  );
}
