"use client";

import { useEffect } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The tracker couldn't load. Nothing is lost: applications, history and reminders are only ever read from what's saved. */
export default function ApplicationsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Applications failed to load:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" role="alert" data-applications-error>
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">Couldn&apos;t load your applications</h1>
      <p className="max-w-md text-sm text-muted-foreground">Something went wrong on our side. Your applications are safe — try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
