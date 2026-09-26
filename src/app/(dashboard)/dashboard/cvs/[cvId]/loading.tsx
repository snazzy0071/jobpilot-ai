import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a CV opens: the toolbar, the section column and the A4 preview, in the editor's own layout. */
export default function CvEditorLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite" aria-busy="true" data-cv-loading="editor">
      <span className="sr-only">Opening your CV…</span>
      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-8 w-56" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-14 rounded-lg" />
          ))}
        </div>
        <Skeleton className="hidden aspect-[210/297] w-full rounded-md lg:block" />
      </div>
    </div>
  );
}
