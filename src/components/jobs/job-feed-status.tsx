import { AlertTriangle, RefreshCw } from "lucide-react";
import type { JobFeedStatus } from "@/lib/jobs/queries";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/**
 * Says how fresh the feed is and whether a source has stopped updating. A failed or overdue sync never empties the feed
 * (jobs are only retired by expiry, see src/lib/jobs/maintenance.ts), so the honest thing is to keep showing them and
 * say which source is behind and since when.
 */
export function JobFeedStatusNotice({ status }: { status: JobFeedStatus }) {
  const problems = status.sources.filter((source) => source.latestRunStatus === "failed" || source.stale);

  return (
    <div className="flex flex-col gap-2 text-sm">
      {status.lastUpdatedAt ? (
        <p className="flex items-center gap-1.5 text-muted-foreground" data-testid="job-feed-updated">
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Feed last updated {formatDateTime(status.lastUpdatedAt)} · {status.totalVisible.toLocaleString("en-GB")} live listings
        </p>
      ) : (
        <p className="text-muted-foreground">The feed hasn&apos;t completed a sync yet.</p>
      )}

      {problems.map((source) => (
        <p key={source.sourceId} role="status" className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {source.latestRunStatus === "failed"
              ? `${source.name}'s latest update failed`
              : `${source.name} hasn't updated recently`}
            {source.lastCompletedAt
              ? `. Its listings below are from its last successful update on ${formatDateTime(source.lastCompletedAt)}.`
              : ". It has never completed an update."}
          </span>
        </p>
      ))}
    </div>
  );
}
