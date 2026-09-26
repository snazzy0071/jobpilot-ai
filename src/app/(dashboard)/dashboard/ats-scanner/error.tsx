"use client";

import { useEffect } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The ATS Scanner couldn't load. Nothing is lost — a past scan is only ever shown from what's already saved. */
export default function AtsScannerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("ATS Scanner failed to load:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" role="alert" data-ats-error>
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">Couldn&apos;t load the ATS Scanner</h1>
      <p className="max-w-md text-sm text-muted-foreground">Something went wrong on our side — try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
