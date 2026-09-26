"use client";

import { RouteError } from "@/components/layout/route-states";

/** Last-resort boundary for anything not inside a dashboard/admin area (public and auth pages). */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center px-6">
      <RouteError error={error} reset={reset} what="this page" homeHref="/" homeLabel="Go to the homepage" />
    </main>
  );
}
