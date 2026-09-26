import { Skeleton } from "@/components/ui/skeleton";

export default function AutoApplyLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading Auto-Apply…</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
