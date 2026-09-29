import { BriefcaseIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getJobFeedHealth } from "@/lib/admin/jobs/queries";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";
}

function statusVariant(status: string): "tinted" | "secondary" | "destructive" {
  if (status === "completed") return "tinted";
  if (status === "failed") return "destructive";
  return "secondary";
}

export default async function AdminJobsPage() {
  const health = await getJobFeedHealth();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Sources</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {health.sources.map((source) => (
            <Card key={source.sourceId} variant="admin" className="gap-2 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BriefcaseIcon className="size-4" /> {source.sourceName}
                </div>
                <Badge variant={source.isActive ? "tinted" : "secondary"}>{source.isActive ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-2xl font-semibold">{source.activeJobCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                Last synced {formatDateTime(source.lastCompletedAt)}
                {source.createdCount !== null ? ` · +${source.createdCount} new last run` : ""}
              </p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Recent sync runs</h2>
        {health.recentRuns.length === 0 ? (
          <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No sync runs yet.</Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fetched / new / updated / duplicates / skipped</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {health.recentRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="text-sm">{run.sourceName ?? "All sources"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{run.runType}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    {run.errorMessage && (
                      <p className={`mt-1 max-w-md text-xs ${run.status === "failed" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                        {run.status === "completed" ? "Completed with warnings: " : ""}
                        {run.errorMessage}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {run.fetchedCount ?? "—"} / {run.createdCount ?? "—"} / {run.updatedCount ?? "—"} / {run.duplicateCount ?? "—"} / {run.skippedCount ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(run.startedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
