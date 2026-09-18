"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createQuestionPack, updateQuestionPack } from "@/lib/test-prep/admin/actions";
import type { AdminQuestionPack } from "@/lib/test-prep/admin/types";

export function QuestionPackForm({ testTypeId, pack }: { testTypeId: string; pack?: AdminQuestionPack }) {
  const router = useRouter();
  const isEditing = !!pack;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(pack?.isActive ?? true);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = isEditing ? await updateQuestionPack(undefined, formData) : await createQuestionPack(formData);

    if (response && "error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push(`/admin/test-prep/test-types/${testTypeId}`);
    router.refresh();
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input type="hidden" name="testTypeId" value={testTypeId} />
        {isEditing && <input type="hidden" name="id" value={pack.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qp-name">Name</Label>
            <Input id="qp-name" name="name" defaultValue={pack?.name} maxLength={200} placeholder="e.g. Data Interpretation" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qp-slug">Slug</Label>
            <Input id="qp-slug" name="slug" defaultValue={pack?.slug} maxLength={100} placeholder="e.g. data-interpretation" required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qp-description">Description (optional)</Label>
          <Textarea id="qp-description" name="description" rows={3} maxLength={2000} defaultValue={pack?.description ?? ""} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qp-sector">Sector style (optional)</Label>
            <Input id="qp-sector" name="sectorStyle" defaultValue={pack?.sectorStyle ?? ""} maxLength={100} placeholder="e.g. Consulting" />
            <p className="text-xs text-muted-foreground">The employer style this pack is themed for — never a real publisher&apos;s own test name.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qp-time-limit">Time limit, seconds (optional)</Label>
            <Input
              id="qp-time-limit"
              name="timeLimitSeconds"
              type="number"
              min={1}
              defaultValue={pack?.timeLimitSeconds ?? ""}
              placeholder="e.g. 600"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="qp-active" name="isActive" value="on" checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
          <Label htmlFor="qp-active" className="text-sm font-normal">
            Active (visible to practice-takers)
          </Label>
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
                <Loader2Icon className="animate-spin" /> Saving…
              </>
            ) : isEditing ? (
              "Save changes"
            ) : (
              "Create pack"
            )}
          </Button>
          <Button type="button" variant="outline" render={<a href={`/admin/test-prep/test-types/${testTypeId}`}>Cancel</a>} />
        </div>
      </form>
    </Card>
  );
}
