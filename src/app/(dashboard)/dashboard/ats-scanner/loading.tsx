import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the ATS Scanner loads: the header, the mode toggle, and the picker/form area, in the page's own layout. */
export default function AtsScannerLoading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-live="polite" aria-busy="true" data-ats-loading>
      <span className="sr-only">Loading the ATS Scanner…</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-72 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-7 w-40" />
      </div>
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
