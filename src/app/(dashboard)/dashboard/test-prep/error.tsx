"use client";

import { useEffect } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Test Prep couldn't load. Your answers and history are stored server-side and are not affected. */
export default function TestPrepError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Test Prep failed to load:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" role="alert" data-testprep-error>
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">Couldn&apos;t load Test Prep</h1>
      <p className="max-w-md text-sm text-muted-foreground">Something went wrong on our side. Your practice history is safe — try again in a moment.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
