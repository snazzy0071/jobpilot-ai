"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteApplication } from "@/lib/applications/actions";

/** Delete from the edit page, then back to the tracker. Confirms first — deleting also removes its history and reminders. */
export function DeleteApplicationButton({ id, companyName, jobTitle }: { id: string; companyName: string; jobTitle: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete "${jobTitle}" at ${companyName}? Its history and reminders are deleted too. This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteApplication(undefined, formData);
    if (result && "error" in result) {
      setDeleting(false);
      setError(result.error);
      return;
    }
    router.push("/dashboard/applications");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" className="self-start text-destructive" onClick={handleDelete} disabled={deleting}>
        {deleting ? <Loader2Icon className="animate-spin" /> : <Trash2 />} Delete application
      </Button>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
