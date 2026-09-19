import { BuildingIcon, ClockIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { getSponsorSyncOverview } from "@/lib/admin/sponsors/queries";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";
}

function statusVariant(status: string): "tinted" | "secondary" | "destructive" {
  if (status === "completed") return "tinted";
  if (status === "failed") return "destructive";
  return "secondary";
}

export default async function AdminSponsorsPage() {
  const overview = await getSponsorSyncOverview();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Sponsor register sync</h1>
        <p className="mt-1 text-muted-foreground">Read-only — this pipeline has no ingestion job wired up yet, so this reflects whatever import history actually exists.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card variant="metric" className="gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BuildingIcon className="size-4" /> Active sponsors
          </div>
          <p className="font-heading text-2xl font-semibold tracking-tight">{overview.activeSponsorCount.toLocaleString()}</p>
        </Card>
        <Card variant="metric" className="gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BuildingIcon className="size-4" /> Total sponsor records
          </div>
          <p className="font-heading text-2xl font-semibold tracking-tight">{overview.totalSponsorCount.toLocaleString()}</p>
        </Card>
        <Card variant="metric" className="gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClockIcon className="size-4" /> Last completed sync
          </div>
          <p className="font-heading text-2xl font-semibold tracking-tight">{formatDateTime(overview.lastCompletedAt)}</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Import history</h2>
        {overview.imports.length === 0 ? (
          <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No sync has ever run.</Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sponsors / routes</TableHead>
                <TableHead>+/- </TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.imports.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="text-sm">{run.sourceDate}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    {run.errorMessage && <p className="mt-1 text-xs text-destructive">{run.errorMessage}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {run.sponsorCount ?? "—"} / {run.routeCount ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    +{run.addedCount ?? 0} / ↻{run.reactivatedCount ?? 0} / -{run.deactivatedCount ?? 0}
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
