"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, EyeIcon, EyeOffIcon, ExternalLink, Loader2Icon, Pencil, ScanEye, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteComparison, setComparisonPublished } from "@/lib/comparisons/actions";
import { isStale, STALE_AFTER_DAYS } from "@/lib/graduate-schemes/staleness";
import type { ComparisonPage } from "@/lib/comparisons/types";

function statusOf(page: ComparisonPage): "live" | "scheduled" | "draft" {
  if (!page.publishedAt) return "draft";
  return new Date(page.publishedAt) <= new Date() ? "live" : "scheduled";
}
const STATUS_LABELS = { live: "Published", scheduled: "Scheduled", draft: "Draft" } as const;

function fmt(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

function RowActions({ page, onError }: { page: ComparisonPage; onError: (message: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const status = statusOf(page);

  async function run(kind: string, action: () => Promise<{ error: string } | { success: string }>) {
    setBusy(kind);
    onError("");
    const result = await action();
    setBusy(null);
    if ("error" in result) {
      onError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon-sm" aria-label={`Preview ${page.competitorName}`} title="Preview (as readers will see it)" render={<Link href={`/admin/compare/${page.id}/preview`} />}>
        <ScanEye className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={status === "draft" ? `Publish ${page.competitorName}` : `Move ${page.competitorName} to drafts`}
        title={status === "draft" ? "Publish now" : "Move to drafts"}
        disabled={busy !== null}
        onClick={() => void run("publish", () => setComparisonPublished({ id: page.id, published: status === "draft" }))}
      >
        {busy === "publish" ? <Loader2Icon className="size-4 animate-spin" /> : status === "draft" ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </Button>
      {status === "live" && (
        <Button variant="ghost" size="icon-sm" aria-label={`View ${page.competitorName}`} render={<Link href={`/compare/${page.slug}`} target="_blank" />}>
          <ExternalLink className="size-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${page.competitorName}`} render={<Link href={`/admin/compare/${page.id}/edit`} />}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${page.competitorName}`}
        disabled={busy !== null}
        onClick={() => {
          if (!window.confirm(`Delete the comparison with ${page.competitorName}? This can't be undone.`)) return;
          void run("delete", () => deleteComparison({ id: page.id }));
        }}
      >
        {busy === "delete" ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

export function ComparisonAdminList({ pages }: { pages: ComparisonPage[] }) {
  const [error, setError] = useState("");
  if (pages.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No comparisons yet</p>
        <p className="text-sm text-muted-foreground">Add one only when you have the competitor&apos;s own pages to source it from.</p>
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
            <TableHead>Competitor</TableHead>
            <TableHead>Content</TableHead>
            <TableHead>Checked</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pages.map((page) => {
            const status = statusOf(page);
            return (
              <TableRow key={page.id} data-testid="admin-comparison-row">
                <TableCell>
                  <p className="font-medium">{page.competitorName}</p>
                  <p className="text-sm text-muted-foreground">/compare/{page.slug}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {page.features.length} features · {page.pricing.length} pricing · {page.differences.length} differences · {page.faqs.length} FAQs
                </TableCell>
                <TableCell className="text-sm">
                  <span data-testid="checked">{fmt(page.updatedOn)}</span>
                  {isStale(page.updatedOn) && (
                    <span className="ml-1.5 inline-flex items-center gap-1 text-warning" title={`Not rechecked in over ${STALE_AFTER_DAYS} days`} data-testid="stale">
                      <AlertTriangle className="size-3.5" aria-hidden="true" /> needs recheck
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={status === "live" ? "tinted" : "outline"} data-testid="status">
                    {STATUS_LABELS[status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RowActions page={page} onError={setError} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
