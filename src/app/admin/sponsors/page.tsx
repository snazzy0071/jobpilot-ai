import Link from "next/link";
import { BuildingIcon, CalendarIcon, ClockIcon, EyeOffIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RunSyncButton } from "@/components/admin/sponsors/run-sync-button";
import { requireAdmin } from "@/lib/auth/session";
import { hasPermission } from "@/lib/admin/permissions";
import { getSponsorSyncOverview } from "@/lib/admin/sponsors/queries";
import type { AdminSponsorSyncState } from "@/lib/admin/sponsors/types";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";
}

function formatDate(date: string | null): string {
  return date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "—";
  const seconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function statusVariant(status: string): "tinted" | "secondary" | "destructive" {
  if (status === "completed") return "tinted";
  if (status === "failed") return "destructive";
  return "secondary";
}

const STATE_COPY: Record<AdminSponsorSyncState, { label: string; variant: "tinted" | "secondary" | "destructive"; detail: (hours: number) => string }> = {
  ok: { label: "Healthy", variant: "tinted", detail: () => "The register was synced recently." },
  running: { label: "Sync running", variant: "secondary", detail: () => "An import is in progress right now." },
  stale: {
    label: "Stale",
    variant: "destructive",
    detail: (hours) => `No sync has completed in over ${hours} hours — the daily schedule may have stopped. The public directory is still showing the last synced data.`,
  },
  failed: { label: "Last run failed", variant: "destructive", detail: () => "The newest sync failed (see the error in the history below). The public directory is still showing the last completed sync." },
  never: { label: "Never synced", variant: "destructive", detail: () => "No sync has ever completed, so the public directory is empty." },
};

export default async function AdminSponsorsPage() {
  const { user } = await requireAdmin();
  const [overview, canRunSync] = await Promise.all([getSponsorSyncOverview(), hasPermission(user.id, "manage_sponsor_sync")]);
  const state = STATE_COPY[overview.state];

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex-row flex-wrap items-start justify-between gap-4 p-5">
        <div className="flex max-w-2xl flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Status</h2>
            <Badge variant={state.variant}>{state.label}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{state.detail(overview.staleAfterHours)}</p>
        </div>
        {canRunSync &&
          (overview.canTriggerSync ? (
            <RunSyncButton disabled={overview.state === "running"} />
          ) : (
            <p className="max-w-xs text-sm text-muted-foreground">
              Manual runs aren&apos;t configured on this deployment — set SPONSOR_SYNC_GITHUB_REPO and SPONSOR_SYNC_GITHUB_TOKEN.
            </p>
          ))}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card variant="metric" className="gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BuildingIcon className="size-4" /> On the register now
          </div>
          <p className="font-heading text-2xl font-semibold tracking-tight">{overview.activeSponsorCount.toLocaleString("en-GB")}</p>
          <p className="text-xs text-muted-foreground">{overview.totalSponsorCount.toLocaleString("en-GB")} records in total</p>
        </Card>
        <Card variant="metric" className="gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <EyeOffIcon className="size-4" /> Removed from the register
          </div>
          <p className="font-heading text-2xl font-semibold tracking-tight">{overview.inactiveSponsorCount.toLocaleString("en-GB")}</p>
          <p className="text-xs text-muted-foreground">Hidden from search; company pages say so</p>
        </Card>
        <Card variant="metric" className="gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarIcon className="size-4" /> Register published
          </div>
          <p className="font-heading text-2xl font-semibold tracking-tight">{formatDate(overview.lastSourceDate)}</p>
          <p className="text-xs text-muted-foreground">Shown to visitors as the data date</p>
        </Card>
        <Card variant="metric" className="gap-1 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ClockIcon className="size-4" /> Last completed sync
          </div>
          <p className="font-heading text-2xl font-semibold tracking-tight">{formatDateTime(overview.lastCompletedAt)}</p>
          <p className="text-xs text-muted-foreground">Stale after {overview.staleAfterHours}h</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-1 text-lg font-semibold tracking-tight">Latest changes</h2>
        <p className="mb-3 text-sm text-muted-foreground">Sponsors that dropped off, or returned to, the register in the last completed sync.</p>
        {overview.latestChanges.length === 0 ? (
          <Card className="items-center gap-2 p-8 text-center text-sm text-muted-foreground">No sponsors were removed or returned in the last completed sync.</Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.latestChanges.map((change) => (
                <TableRow key={`${change.sponsorId}-${change.changeType}`}>
                  <TableCell className="text-sm">
                    <Link href={`/visa-sponsors/companies/${change.sponsorId}`} className="font-medium underline-offset-4 hover:underline">
                      {change.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={change.changeType === "deactivated" ? "secondary" : "tinted"}>
                      {change.changeType === "deactivated" ? "Removed" : "Returned"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(change.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
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
                <TableHead>Added / returned / removed</TableHead>
                <TableHead>Routes / aliases pruned</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Took</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.imports.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="text-sm">{formatDate(run.sourceDate)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
                    {run.errorMessage && <p className="mt-1 max-w-xs text-xs text-destructive">{run.errorMessage}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {run.sponsorCount?.toLocaleString("en-GB") ?? "—"} / {run.routeCount?.toLocaleString("en-GB") ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    +{(run.addedCount ?? 0).toLocaleString("en-GB")} / ↻{(run.reactivatedCount ?? 0).toLocaleString("en-GB")} / −{(run.deactivatedCount ?? 0).toLocaleString("en-GB")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {run.status === "completed" ? `${run.routesRemovedCount ?? 0} / ${run.aliasesRemovedCount ?? 0}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(run.startedAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDuration(run.startedAt, run.completedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
