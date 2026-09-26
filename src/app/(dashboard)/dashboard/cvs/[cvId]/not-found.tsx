import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A CV that doesn't exist, was deleted, or belongs to someone else — all look the same from here, by design. */
export default function CvNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center" data-cv-not-found>
      <FileQuestionIcon className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="font-heading text-xl font-semibold">We couldn&apos;t find that CV</h1>
      <p className="max-w-md text-sm text-muted-foreground">It may have been deleted, or the link may be wrong.</p>
      <Button render={<Link href="/dashboard/cvs" />}>Back to your CVs</Button>
    </div>
  );
}
