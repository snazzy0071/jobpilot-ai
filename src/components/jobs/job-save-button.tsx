"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveJob, unsaveJob } from "@/lib/jobs/wishlist/actions";

/**
 * One-click save/unsave straight from the feed — saveJob resolves
 * company/title/url/source/sponsor state/match score server-side
 * (src/lib/jobs/wishlist/actions.ts), this button just triggers it and
 * reflects the result; it never assembles or sends that data itself.
 */
export function JobSaveButton({ jobId, cvId, initialSaved }: { jobId: string; cvId?: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    if (saved) {
      const result = await unsaveJob({ jobId });
      setLoading(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSaved(false);
      return;
    }

    const result = await saveJob({ jobId, cvId });
    setLoading(false);
    if ("error" in result) {
      // Already saved elsewhere (another tab, a previous click that
      // succeeded before this one returned) — reflect that as saved
      // rather than leaving the button stuck on "Save".
      if (result.error.includes("already saved")) {
        setSaved(true);
        return;
      }
      setError(result.error);
      return;
    }
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant={saved ? "secondary" : "outline"}
        size="sm"
        onClick={handleClick}
        disabled={loading}
        aria-pressed={saved}
        aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      >
        {loading ? (
          <Loader2Icon className="size-3.5 animate-spin" />
        ) : saved ? (
          <BookmarkCheck className="size-3.5" />
        ) : (
          <Bookmark className="size-3.5" />
        )}
        {saved ? "Saved" : "Save"}
      </Button>
      {error && (
        <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <AlertCircleIcon className="size-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
