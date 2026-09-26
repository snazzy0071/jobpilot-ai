import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the CV list loads: same header and card grid as the page, so nothing jumps when the data arrives. */
export default function CvsLoading() {
  return (
    <div className="flex flex-col gap-8" role="status" aria-live="polite" aria-busy="true" data-cv-loading="list">
      <span className="sr-only">Loading your CVs…</span>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="min-h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
