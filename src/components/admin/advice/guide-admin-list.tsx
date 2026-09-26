"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, ExternalLink, Loader2Icon, Pencil, StarIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteGuide, setGuideFeatured, setGuidePublished } from "@/lib/advice/actions";
import { ADVICE_CATEGORIES, ADVICE_CATEGORY_LABELS } from "@/lib/advice/categories";
import { isLive, type AdviceGuide } from "@/lib/advice/types";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function statusOf(guide: AdviceGuide): "live" | "scheduled" | "draft" {
  if (!guide.publishedAt) return "draft";
  return isLive(guide) ? "live" : "scheduled";
}
const STATUS_LABELS = { live: "Published", scheduled: "Scheduled", draft: "Draft" } as const;

function RowActions({ guide, onError }: { guide: AdviceGuide; onError: (message: string) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const status = statusOf(guide);

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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={status === "draft" ? `Publish ${guide.title}` : `Move ${guide.title} to drafts`}
        title={status === "draft" ? "Publish now" : "Move to drafts"}
        disabled={busy !== null}
        onClick={() => void run("publish", () => setGuidePublished({ id: guide.id, published: status === "draft" }))}
      >
        {busy === "publish" ? <Loader2Icon className="size-4 animate-spin" /> : status === "draft" ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={guide.featuredRank === null ? `Feature ${guide.title}` : `Remove ${guide.title} from featured`}
        aria-pressed={guide.featuredRank !== null}
        disabled={busy !== null}
        onClick={() => void run("feature", () => setGuideFeatured({ id: guide.id, featured: guide.featuredRank === null }))}
      >
        {busy === "feature" ? <Loader2Icon className="size-4 animate-spin" /> : <StarIcon className={`size-4 ${guide.featuredRank !== null ? "fill-current text-primary" : ""}`} />}
      </Button>
      {status === "live" && (
        <Button variant="ghost" size="icon-sm" aria-label={`View ${guide.title}`} render={<Link href={`/advice-hub/${guide.slug}`} target="_blank" />}>
          <ExternalLink className="size-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${guide.title}`} render={<Link href={`/admin/advice-hub/${guide.id}/edit`} />}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${guide.title}`}
        disabled={busy !== null}
        onClick={() => {
          if (!window.confirm(`Delete "${guide.title}"? This can't be undone.`)) return;
          void run("delete", () => deleteGuide({ id: guide.id }));
        }}
      >
        {busy === "delete" ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      </Button>
    </div>
  );
}

export function GuideAdminList({ guides }: { guides: AdviceGuide[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return guides.filter((guide) => (!category || guide.category === category) && (!status || statusOf(guide) === status) && (!needle || `${guide.title} ${guide.slug}`.toLowerCase().includes(needle)));
  }, [guides, search, category, status]);

  if (guides.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No guides yet</p>
        <p className="text-sm text-muted-foreground">Create the first one.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ag-search">Search</Label>
          <Input id="ag-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Title or slug" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ag-category">Category</Label>
          <select id="ag-category" value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT_CLASS}>
            <option value="">All categories</option>
            {ADVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {ADVICE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ag-status">Status</Label>
          <select id="ag-status" value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT_CLASS}>
            <option value="">Any status</option>
            <option value="live">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>
      <p className="text-sm text-muted-foreground" role="status" data-testid="admin-count">
        Showing {visible.length} of {guides.length} guide{guides.length === 1 ? "" : "s"}.
      </p>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Guide</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((guide) => {
            const s = statusOf(guide);
            return (
              <TableRow key={guide.id} data-testid="admin-guide-row">
                <TableCell>
                  <p className="font-medium">
                    {guide.title}
                    {guide.featuredRank !== null && (
                      <Badge variant="tinted" className="ml-2" data-testid="featured-badge">
                        Featured #{guide.featuredRank}
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">/{guide.slug}</p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{ADVICE_CATEGORY_LABELS[guide.category]}</TableCell>
                <TableCell>
                  <Badge variant={s === "live" ? "tinted" : "outline"} data-testid="status">
                    {STATUS_LABELS[s]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <RowActions guide={guide} onError={setError} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
