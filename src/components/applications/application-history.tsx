import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { APPLICATION_STATUS_LABELS, type ApplicationStatusHistoryEntry } from "@/lib/applications/types";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Every status this application has been in, oldest first. Written by the database on each change (migration 0063), so it can't miss a move or be edited from the app. */
export function ApplicationHistory({ entries }: { entries: ApplicationStatusHistoryEntry[] }) {
  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-3" data-testid="application-history">
      <h2 id="history-heading" className="flex items-center gap-1.5 text-sm font-semibold">
        <History className="size-4" aria-hidden="true" /> History
      </h2>
      <Card className="p-4">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history recorded.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  {entry.fromStatus ? (
                    <>
                      Moved from <strong>{APPLICATION_STATUS_LABELS[entry.fromStatus]}</strong> to <strong>{APPLICATION_STATUS_LABELS[entry.toStatus]}</strong>
                    </>
                  ) : (
                    <>
                      Added as <strong>{APPLICATION_STATUS_LABELS[entry.toStatus]}</strong>
                    </>
                  )}
                  {entry.note ? <span className="text-muted-foreground"> — {entry.note}</span> : null}
                </span>
                <time dateTime={entry.changedAt} className="text-xs text-muted-foreground">
                  {formatDateTime(entry.changedAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </section>
  );
}
