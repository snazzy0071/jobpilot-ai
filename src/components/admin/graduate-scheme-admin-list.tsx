"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, EyeIcon, EyeOffIcon, Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteGraduateScheme, setSchemePublished } from "@/lib/graduate-schemes/actions";
import {
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  type GraduateScheme,
  type GraduateSchemeSponsorshipStatus,
} from "@/lib/graduate-schemes/types";
import { APPLICATION_STATUS_LABELS, applicationStatus } from "@/lib/graduate-schemes/status";
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

function RowActions({ scheme, onError }: { scheme: GraduateScheme; onError: (message: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"delete" | "publish" | null>(null);

  async function run(kind: "delete" | "publish", action: () => Promise<unknown>) {
    setBusy(kind);
    onError("");
    const result = await action();
    setBusy(null);
    if (result && typeof result === "object" && "error" in result) {
      onError((result as { error: string }).error);
      return;
    }
    router.refresh();
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${scheme.schemeName}" (${scheme.employer})? This can't be undone.`)) return;
    const formData = new FormData();
    formData.set("id", scheme.id);
    void run("delete", () => deleteGraduateScheme(undefined, formData));
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={scheme.isPublished ? `Unpublish ${scheme.schemeName}` : `Publish ${scheme.schemeName}`}
        title={scheme.isPublished ? "Unpublish (make a draft)" : "Publish"}
        disabled={busy !== null}
        onClick={() => void run("publish", () => setSchemePublished({ id: scheme.id, isPublished: !scheme.isPublished }))}
      >
        {busy === "publish" ? <Loader2Icon className="size-4 animate-spin" /> : scheme.isPublished ? <EyeIcon className="size-4" /> : <EyeOffIcon className="size-4" />}
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${scheme.schemeName}`} render={<Link href={`/admin/graduate-schemes/${scheme.id}/edit`} />}>
        <Pencil className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${scheme.schemeName}`} onClick={handleDelete} disabled={busy !== null}>
        {busy === "delete" ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

/** Every scheme, drafts included, with an inline "needs review" flag for anything not rechecked in the last STALE_AFTER_DAYS days — the freshness signal verified_at exists for. */
export function GraduateSchemeAdminList({ schemes }: { schemes: GraduateScheme[] }) {
  const [error, setError] = useState("");

  if (schemes.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No graduate schemes yet</p>
        <p className="text-sm text-muted-foreground">Add one manually, or import a CSV of several at once. Only add schemes you have a source for.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Scheme</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead>Applications</TableHead>
            <TableHead>Assessments</TableHead>
            <TableHead>Sponsorship</TableHead>
            <TableHead>Verified</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schemes.map((scheme) => {
            const stale = isStale(scheme.verifiedAt);
            return (
              <TableRow key={scheme.id} data-testid="admin-scheme-row">
                <TableCell>
                  <p className="font-medium">
                    {scheme.isPublished ? (
                      <Link href={`/graduate-schemes/${scheme.slug}`} className="hover:underline">
                        {scheme.schemeName}
                      </Link>
                    ) : (
                      scheme.schemeName
                    )}
                    {!scheme.isPublished && (
                      <Badge variant="outline" className="ml-2">
                        Draft
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{scheme.employer}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {APPLICATION_STATUS_LABELS[applicationStatus(scheme)]}
                  {scheme.isRolling ? " · rolling" : ""}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground" data-testid="assessment-count">
                  {scheme.assessments.length === 0 ? "None mapped" : `${scheme.assessments.length} mapped`}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE_VARIANT[scheme.sponsorshipStatus]}>{GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[scheme.sponsorshipStatus]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-sm">
                    {formatDate(scheme.verifiedAt)}
                    {stale && (
                      <span title={`Not rechecked in over ${STALE_AFTER_DAYS} days`} className="inline-flex items-center gap-1 text-warning">
                        <AlertTriangle className="size-3.5" />
                        <span className="sr-only">Needs review</span>
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <a href={scheme.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
                    View <ExternalLink className="size-3" />
                  </a>
                </TableCell>
                <TableCell>
                  <RowActions scheme={scheme} onError={setError} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
