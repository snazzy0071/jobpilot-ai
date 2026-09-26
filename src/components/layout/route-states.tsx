"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertCircleIcon, FileQuestionIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Shared building blocks for the route-segment loading.tsx / error.tsx / not-found.tsx files, so every area of the app has the same
// three honest states instead of a blank screen, a raw stack trace or Next's default 404. The error screen never shows the thrown
// error's message (it can contain internals); it is logged for us and a digest is shown for support.

export function RouteError({ error, reset, what, homeHref, homeLabel }: { error: Error & { digest?: string }; reset: () => void; what: string; homeHref: string; homeLabel: string }) {
  useEffect(() => {
    console.error(`${what} failed to load:`, error);
  }, [error, what]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" role="alert" data-route-error>
      <AlertCircleIcon className="size-8 text-destructive" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">We couldn&apos;t load {what}. Nothing you saved has been lost. Try again, or head back.</p>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" render={<Link href={homeHref}>{homeLabel}</Link>} />
      </div>
    </div>
  );
}

export function RouteNotFound({ homeHref, homeLabel }: { homeHref: string; homeLabel: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" data-route-not-found>
      <FileQuestionIcon className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="text-sm text-muted-foreground">It may have been moved or deleted, or the link may be wrong.</p>
      <Button render={<Link href={homeHref}>{homeLabel}</Link>} />
    </div>
  );
}

export function RouteLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-busy="true" data-route-loading>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="hidden h-32 rounded-xl lg:block" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  );
}
