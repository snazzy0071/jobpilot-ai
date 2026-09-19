"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteGraduateScheme } from "@/lib/graduate-schemes/actions";
import {
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  type GraduateScheme,
  type GraduateSchemeSponsorshipStatus,
} from "@/lib/graduate-schemes/types";
import { isStale, STALE_AFTER_DAYS } from "@/lib/graduate-schemes/staleness";

const STATUS_BADGE_VARIANT: Record<GraduateSchemeSponsorshipStatus, "default" | "secondary" | "destructive" | "outline"> = {
  sponsors: "default",
  some_tracks: "secondary",
  no: "destructive",
  not_published: "outline",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function DeleteButton({ id, employer, schemeName }: { id: string; employer: string; schemeName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${schemeName}" (${employer})? This can't be undone.`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteGraduateScheme(undefined, formData);
    if (result && "error" in result) {
      setDeleting(false);
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${schemeName}`} onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

/** Real rows from src/lib/graduate-schemes/queries.ts's getGraduateSchemes, with an inline "needs review" flag for anything not rechecked in the last STALE_AFTER_DAYS days — the freshness signal verified_at exists for (see migration 0056's own comment). */
export function GraduateSchemeAdminList({ schemes }: { schemes: GraduateScheme[] }) {
  if (schemes.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No graduate schemes yet</p>
        <p className="text-sm text-muted-foreground">Add one manually, or import a CSV of several at once.</p>
      </Card>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Scheme</TableHead>
          <TableHead>Sector</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Verified</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schemes.map((scheme) => {
          const stale = isStale(scheme.verifiedAt);
          return (
            <TableRow key={scheme.id}>
              <TableCell>
                <p className="font-medium">{scheme.schemeName}</p>
                <p className="text-sm text-muted-foreground">{scheme.employer}</p>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}</TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE_VARIANT[scheme.sponsorshipStatus]}>
                  {GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[scheme.sponsorshipStatus]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 text-sm">
                  {formatDate(scheme.verifiedAt)}
                  {stale && (
                    <span
                      title={`Not rechecked in over ${STALE_AFTER_DAYS} days`}
                      className="inline-flex items-center gap-1 text-warning"
                    >
                      <AlertTriangle className="size-3.5" />
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <a
                  href={scheme.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  View <ExternalLink className="size-3" />
                </a>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${scheme.schemeName}`}
                    render={<Link href={`/admin/graduate-schemes/${scheme.id}/edit`} />}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <DeleteButton id={scheme.id} employer={scheme.employer} schemeName={scheme.schemeName} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
