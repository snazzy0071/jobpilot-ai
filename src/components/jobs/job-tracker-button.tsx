"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, CheckIcon, ClipboardListIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addJobToTracker } from "@/lib/jobs/tracker/actions";

/**
 * "Add to tracker": one click turns a job (from the feed, or a saved job) into a Wishlist application. What the
 * application contains is decided server-side from the job itself (src/lib/jobs/tracker/actions.ts); this button only
 * says which job. Once tracked it becomes a link to the tracker.
 */
export function JobTrackerButton({
  jobId,
  savedJobId,
  cvId,
  initialApplicationId,
}: {
  jobId?: string;
  savedJobId?: string;
  cvId?: string;
  initialApplicationId: string | null;
}) {
  const [applicationId, setApplicationId] = useState(initialApplicationId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await addJobToTracker({ jobId, savedJobId, cvId });
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setApplicationId(result.applicationId);
  }

  if (applicationId) {
    return (
      <Button variant="secondary" size="sm" render={<Link href="/dashboard/applications" />}>
        <CheckIcon className="size-3.5" /> In tracker
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2Icon className="size-3.5 animate-spin" /> : <ClipboardListIcon className="size-3.5" />}
        Add to tracker
      </Button>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <AlertCircleIcon className="size-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
