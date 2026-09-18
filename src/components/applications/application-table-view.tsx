"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2Icon, Lock, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteApplication } from "@/lib/applications/actions";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type Application, type ApplicationStatus } from "@/lib/applications/types";

const SPONSOR_LABELS: Partial<Record<string, string>> = {
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
  not_found: "Not on register",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function DeleteButton({ id, companyName, jobTitle, onDeleted }: { id: string; companyName: string; jobTitle: string; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${jobTitle}" at ${companyName}? This can't be undone.`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteApplication(undefined, formData);
    if (result && "error" in result) {
      setDeleting(false);
      window.alert(result.error);
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
 * Same underlying, already-filtered/sorted `applications` array the
 * board view renders (src/components/applications/
 * application-tracker-board.tsx owns the filtering/sorting once, for
 * both views) — this component only ever lays it out differently, it
 * never re-derives or re-fetches anything of its own.
 */
export function ApplicationTableView({
  applications,
  cvs,
  onStatusChange,
  onDeleted,
}: {
  applications: Application[];
  cvs: { id: string; title: string }[];
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDeleted: (id: string) => void;
}) {
  if (applications.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No applications match these filters</p>
        <p className="text-sm text-muted-foreground">Try clearing a filter or search term.</p>
      </Card>
    );
  }

  const cvTitleById = new Map(cvs.map((cv) => [cv.id, cv.title]));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Deadline</TableHead>
          <TableHead>Sponsor state</TableHead>
          <TableHead>CV</TableHead>
          <TableHead>Match</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {applications.map((application) => {
          const sponsorLabel = application.sponsorStatus ? SPONSOR_LABELS[application.sponsorStatus] : undefined;
          return (
            <TableRow key={application.id}>
              <TableCell>
                <p className="font-medium">{application.jobTitle}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  {application.companyName}
                  {application.url && (
                    <a href={application.url} target="_blank" rel="noopener noreferrer" aria-label="Open job posting">
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </p>
              </TableCell>
              <TableCell>
                <Select value={application.status} onValueChange={(value) => value && onStatusChange(application.id, value as ApplicationStatus)}>
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
              <TableCell className="text-sm text-muted-foreground">{application.deadline ? formatDate(application.deadline) : "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {sponsorLabel ? (
                    <Badge variant={application.sponsorStatus === "confirmed_sponsor" ? "tinted" : "outline"}>{sponsorLabel}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not checked</span>
                  )}
                  {application.frozenAt && (
                    <span title="Sponsor state, match score and submitted CV version are frozen">
                      <Lock className="size-3 text-muted-foreground" role="img" aria-label="Frozen since first moved to Applied" />
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{application.cvId ? (cvTitleById.get(application.cvId) ?? "CV") : "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{application.matchScore !== null ? `${application.matchScore}/100` : "—"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${application.jobTitle}`}
                    render={<Link href={`/dashboard/applications/${application.id}/edit`} />}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <DeleteButton id={application.id} companyName={application.companyName} jobTitle={application.jobTitle} onDeleted={onDeleted} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
