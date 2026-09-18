"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createInstitution } from "@/lib/admin/institutions/actions";

export function CreateInstitutionForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await createInstitution(formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error ?? "Couldn't create that institution — try again.");
      return;
    }
    if (result && "id" in result) {
      router.push(`/admin/institutions/${result.id}`);
      router.refresh();
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="inst-name">Name</Label>
          <Input id="inst-name" name="name" maxLength={200} placeholder="e.g. University of Manchester" required />
        </div>
        <div className="flex min-w-40 flex-col gap-1.5">
          <Label htmlFor="inst-slug">Slug</Label>
          <Input id="inst-slug" name="slug" maxLength={100} placeholder="e.g. manchester" required />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Creating…
            </>
          ) : (
            "Create institution"
          )}
        </Button>
      </form>
      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}
    </Card>
  );
}
