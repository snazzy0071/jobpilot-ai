"use client";

import { RouteError } from "@/components/layout/route-states";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} reset={reset} what="this page" homeHref="/institution-admin" homeLabel="Back to the overview" />;
}
