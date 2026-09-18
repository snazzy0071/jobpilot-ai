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
import { createTestType, updateTestType } from "@/lib/test-prep/admin/actions";
import type { AdminTestType } from "@/lib/test-prep/admin/types";

export function TestTypeForm({ testType }: { testType?: AdminTestType }) {
  const router = useRouter();
  const isEditing = !!testType;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(testType?.isActive ?? true);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = isEditing ? await updateTestType(undefined, formData) : await createTestType(formData);

    if (response && "error" in response) {
      setLoading(false);
      setError(response.error);
      return;
    }
    router.push("/admin/test-prep");
    router.refresh();
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={testType.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tt-name">Name</Label>
            <Input id="tt-name" name="name" defaultValue={testType?.name} maxLength={200} placeholder="e.g. Numerical Reasoning" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tt-slug">Slug</Label>
            <Input id="tt-slug" name="slug" defaultValue={testType?.slug} maxLength={100} placeholder="e.g. numerical-reasoning" required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tt-description">Description (optional)</Label>
          <Textarea id="tt-description" name="description" rows={3} maxLength={2000} defaultValue={testType?.description ?? ""} />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="tt-active" name="isActive" value="on" checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
          <Label htmlFor="tt-active" className="text-sm font-normal">
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
              "Create test type"
            )}
          </Button>
          <Button type="button" variant="outline" render={<a href="/admin/test-prep">Cancel</a>} />
        </div>
      </form>
    </Card>
  );
}
