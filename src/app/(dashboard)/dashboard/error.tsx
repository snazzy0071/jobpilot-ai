"use client";

import { RouteError } from "@/components/layout/route-states";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} what="this page" homeHref="/dashboard" homeLabel="Back to your dashboard" />;
}
