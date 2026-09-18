"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addInstitutionAdmin } from "@/lib/admin/institutions/actions";
import type { AdminInstitutionAdminAccount } from "@/lib/admin/institutions/types";

export function AddAdminForm({ institutionId, admins }: { institutionId: string; admins: AdminInstitutionAdminAccount[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(event.currentTarget);
    const result = await addInstitutionAdmin(formData);
    setSubmitting(false);
    if (result && "error" in result) {
      setError(result.error);
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <Card className="gap-4 p-6">
      <h2 className="text-sm font-semibold">Institution admins</h2>
      {admins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No admins yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {admins.map((account) => (
            <li key={account.userId}>
              {account.fullName ?? "—"} — {account.email ?? "—"}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="institutionId" value={institutionId} />
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <Label htmlFor="add-admin-email">Add admin by email</Label>
          <Input id="add-admin-email" name="email" type="email" placeholder="person@example.com" required />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Adding…
            </>
          ) : (
            "Add"
          )}
        </Button>
      </form>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">The account must already exist (they need to sign up first) and must not already belong to a different institution.</p>
    </Card>
  );
}
