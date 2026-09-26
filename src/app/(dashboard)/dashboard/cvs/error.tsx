"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The CV list couldn't load — say so, and let the user retry instead of showing a blank page. */
export default function CvsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("CV list failed to load:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" role="alert" data-cv-error="list">
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">Couldn&apos;t load your CVs</h1>
      <p className="max-w-md text-sm text-muted-foreground">Something went wrong on our side. Your CVs are safe — try again in a moment.</p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
