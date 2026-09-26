"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The editor couldn't load. Nothing typed is lost (edits are saved as you go); retry, or go back to the list. */
export default function CvEditorError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("CV editor failed to load:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" role="alert" data-cv-error="editor">
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">Couldn&apos;t open this CV</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Something went wrong on our side. Anything you had already typed was saved as you went — try again in a moment.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link href="/dashboard/cvs" />}>
          All CVs
        </Button>
      </div>
    </div>
  );
}
