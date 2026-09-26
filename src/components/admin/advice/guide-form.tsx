"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ContentBlockEditor } from "@/components/admin/blog/content-block-editor";
import { createGuide, updateGuide } from "@/lib/advice/actions";
import { ADVICE_CATEGORIES, ADVICE_CATEGORY_LABELS } from "@/lib/advice/categories";
import type { AdviceGuide } from "@/lib/advice/types";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** The publish time in UK local time, as a datetime-local value. */
function ukLocalValue(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}`;
}

export function GuideForm({ guide }: { guide?: AdviceGuide }) {
  const router = useRouter();
  const isEditing = !!guide;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const response = isEditing ? await updateGuide(undefined, formData) : await createGuide(formData);
    if ("error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push("/admin/advice-hub");
    router.refresh();
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={guide.id} />}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-title">Title</Label>
          <Input id="g-title" name="title" defaultValue={guide?.title} maxLength={200} required />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-category">Category</Label>
            <select id="g-category" name="category" defaultValue={guide?.category ?? "cv"} className={SELECT_CLASS}>
              {ADVICE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {ADVICE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-slug">URL slug (optional)</Label>
            <Input id="g-slug" name="slug" defaultValue={guide?.slug} maxLength={200} placeholder="generated from the title" />
            <p className="text-xs text-muted-foreground">Address: /advice-hub/&lt;slug&gt;. Changing it after publishing breaks existing links.</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-summary">Summary</Label>
          <Textarea id="g-summary" name="summary" defaultValue={guide?.summary} maxLength={500} rows={2} required />
          <p className="text-xs text-muted-foreground">Shown on cards and in search results, and used as the page&apos;s description.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-author">Author (optional)</Label>
            <Input id="g-author" name="authorName" defaultValue={guide?.authorName ?? ""} maxLength={100} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-reviewed">Last reviewed (optional)</Label>
            <Input id="g-reviewed" name="reviewedOn" type="date" defaultValue={guide?.reviewedOn ?? ""} />
            <p className="text-xs text-muted-foreground">The date someone last checked the advice still holds. Shown to readers.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-featured">Featured order (optional)</Label>
            <Input id="g-featured" name="featuredRank" type="number" min={1} max={100} defaultValue={guide?.featuredRank ?? ""} />
            <p className="text-xs text-muted-foreground">1 shows first in the hub&apos;s Featured row; blank = not featured.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-publish">Publish at (UK time, optional)</Label>
            <Input id="g-publish" name="publishAt" type="datetime-local" defaultValue={ukLocalValue(guide?.publishedAt ?? null)} />
            <p className="text-xs text-muted-foreground">Blank keeps it as it is (a new guide stays a draft). A future time schedules it. Use the Publish button on the list to publish now.</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-related">Related guides (optional)</Label>
          <Input id="g-related" name="relatedSlugs" defaultValue={guide?.relatedSlugs.join(", ") ?? ""} placeholder="slug-one, slug-two" />
          <p className="text-xs text-muted-foreground">Up to 6 guide slugs, shown first; the rest are filled in from the same category.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Content</Label>
          <ContentBlockEditor initialBlocks={guide?.content ?? []} />
          <p className="text-xs text-muted-foreground">Headings become the table of contents; a blank heading id is generated from its text.</p>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Saving…
              </>
            ) : isEditing ? (
              "Save guide"
            ) : (
              "Create guide"
            )}
          </Button>
          <Button type="button" variant="outline" render={<a href="/admin/advice-hub">Cancel</a>} />
        </div>
      </form>
    </Card>
  );
}
