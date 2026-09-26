"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ExternalLink, Loader2Icon, Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteApplication } from "@/lib/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus } from "@/lib/applications/types";
import type { ReminderSummary } from "@/lib/applications/reminders/queries";
import { deadlineState } from "@/lib/applications/view";

const SPONSOR_LABELS: Partial<Record<string, string>> = {
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
  not_found: "Not on register",
};

function formatDay(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
}

function DeleteButton({
  id,
  companyName,
  jobTitle,
  onDeleted,
  onError,
}: {
  id: string;
  companyName: string;
  jobTitle: string;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${jobTitle}" at ${companyName}? This can't be undone.`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteApplication(undefined, formData);
    if (result && "error" in result) {
      setDeleting(false);
      onError(result.error);
      return;
    }
    onDeleted(id);
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${jobTitle} at ${companyName}`} onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

/**
 * The same already-filtered, already-sorted list the board renders (application-tracker-board.tsx computes it once for
 * both views) — this only lays it out as a table.
 */
export function ApplicationTableView({
  applications,
  cvs,
  coverLetters,
  reminders,
  today,
  onStatusChange,
  onDeleted,
}: {
  applications: Application[];
  cvs: { id: string; title: string }[];
  coverLetters: { id: string; companyName: string; jobTitle: string }[];
  reminders: Record<string, ReminderSummary>;
  today: string;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDeleted: (id: string) => void;
}) {
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (applications.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No applications match these filters</p>
        <p className="text-sm text-muted-foreground">Try clearing a filter or search term.</p>
      </Card>
    );
  }

  const cvTitleById = new Map(cvs.map((cv) => [cv.id, cv.title]));
  const letterById = new Map(coverLetters.map((letter) => [letter.id, letter.companyName]));

  return (
    <div className="flex flex-col gap-2">
      {deleteError && (
        <p className="text-sm text-destructive" role="alert">
          {deleteError}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Applied</TableHead>
            <TableHead>Deadline</TableHead>
            <TableHead>Salary</TableHead>
            <TableHead>Sponsor state</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>CV / letter</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => {
            const sponsorLabel = application.sponsorStatus ? SPONSOR_LABELS[application.sponsorStatus] : undefined;
            const state = deadlineState(application, today);
            const reminder = reminders[application.id];
            return (
              <TableRow key={application.id} data-testid="application-row">
                <TableCell>
                  <p className="font-medium">{application.jobTitle}</p>
                  <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground">
                    {application.companyName}
                    {application.location ? ` · ${application.location}` : ""}
                    {application.url && (
                      <a href={application.url} target="_blank" rel="noopener noreferrer" aria-label="Open job posting">
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </p>
                </TableCell>
                <TableCell>
                  <Select items={APPLICATION_STATUS_LABELS} value={application.status} onValueChange={(value) => value && onStatusChange(application.id, value as ApplicationStatus)}>
                    <SelectTrigger size="sm" className="w-[140px]" aria-label={`Move ${application.jobTitle} to a different status`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APPLICATION_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {APPLICATION_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{application.appliedAt ? formatDay(application.appliedAt) : "—"}</TableCell>
                <TableCell className="text-sm">
                  {application.deadline ? (
                    <span className={state === "overdue" ? "font-medium text-destructive" : state === "soon" ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground"}>
                      {state === "overdue" ? "Overdue · " : ""}
                      {formatDay(application.deadline)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {reminder && (
                    <p className={`flex items-center gap-1 text-xs ${reminder.overdue > 0 ? "font-medium text-destructive" : "text-muted-foreground"}`}>
                      <Bell className="size-3" aria-hidden="true" />
                      {reminder.overdue > 0 ? `${reminder.overdue} due` : `${reminder.open} reminder${reminder.open === 1 ? "" : "s"}`}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{application.salary ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {sponsorLabel ? (
                      <Badge variant={application.sponsorStatus === "confirmed_sponsor" ? "tinted" : "outline"}>{sponsorLabel}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not checked</span>
                    )}
                    {application.frozenAt && (
                      <span title="Sponsor state, match score and the submitted CV are frozen">
                        <Lock className="size-3 text-muted-foreground" role="img" aria-label="Frozen since first moved to Applied" />
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{application.matchScore !== null ? `${application.matchScore}/100` : "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {application.cvId ? (cvTitleById.get(application.cvId) ?? "CV") : "—"}
                  {application.coverLetterId && <p className="text-xs">{letterById.get(application.coverLetterId) ?? "Cover letter"}</p>}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${application.jobTitle}`} render={<Link href={`/dashboard/applications/${application.id}/edit`} />}>
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteButton id={application.id} companyName={application.companyName} jobTitle={application.jobTitle} onDeleted={onDeleted} onError={setDeleteError} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
