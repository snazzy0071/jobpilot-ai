import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the tracker loads: the header, the filter bar and the board's columns, in the page's own layout. */
export default function ApplicationsLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading your applications…</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-56" />
      </div>
      <Skeleton className="h-28 rounded-xl" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-72 w-[280px] shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
