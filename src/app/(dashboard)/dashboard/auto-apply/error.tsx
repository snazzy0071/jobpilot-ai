"use client";

import { useEffect } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Auto-Apply couldn't load. Nothing is lost or sent: queued applications only move when you approve them. */
export default function AutoApplyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Auto-Apply failed to load:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" role="alert">
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">Couldn&apos;t load Auto-Apply</h1>
      <p className="max-w-md text-sm text-muted-foreground">Something went wrong on our side. Nothing has been applied for — try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
