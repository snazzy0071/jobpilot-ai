"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createBlogCategory, createBlogAuthor } from "@/lib/admin/blog/actions";

function QuickCreateForm({
  title,
  action,
  fields,
}: {
  title: string;
  action: (formData: FormData) => Promise<{ error: string } | undefined | void>;
  fields: React.ReactNode;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await action(formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <Card className="gap-3 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        {fields}
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
          Add
        </Button>
      </form>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircleIcon className="size-3.5 shrink-0" /> {error}
        </p>
      )}
    </Card>
  );
}

export function CategoryAuthorForms() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <QuickCreateForm
        title="New category"
        action={createBlogCategory}
        fields={
          <>
            <Input name="name" placeholder="Name" aria-label="Category name" className="w-32" required />
            <Input name="slug" placeholder="slug" aria-label="Category slug" className="w-28" required />
          </>
        }
      />
      <QuickCreateForm
        title="New author"
        action={createBlogAuthor}
        fields={
          <>
            <Input name="name" placeholder="Name" aria-label="Author name" className="w-32" required />
            <Input name="slug" placeholder="slug" aria-label="Author slug" className="w-28" required />
            <Input name="bio" placeholder="Bio (optional)" aria-label="Author bio" className="w-40" />
          </>
        }
      />
    </div>
  );
}
