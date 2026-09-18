import Link from "next/link";
import { FileTextIcon, ArrowRightIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CvListItem } from "@/lib/cvs/types";

function formatUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * reference/auth/dashboard.png's "Continue editing" widget, built from
 * the same most-recently-updated CV data the CV list page already
 * sorts by. No thumbnail image: this app doesn't render a visual CV
 * preview image anywhere yet (docs/SCREENSHOT_MAP.md flagged this gap
 * on the CV list itself already) — a plain icon tile here is honest
 * about that rather than faking a snapshot.
 */
export function ContinueEditingCard({ cv }: { cv: CvListItem | null }) {
  if (!cv) return null;

  return (
    <Card className="flex flex-row items-center gap-5 p-6">
      <div className="flex size-20 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
        <FileTextIcon className="size-7 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Continue editing</p>
        <p className="mt-1 truncate font-heading text-lg font-semibold">{cv.title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Updated {formatUpdatedAt(cv.updatedAt)} · {cv.atsScore === null ? "No ATS scan yet" : `ATS ${cv.atsScore}/100`}
        </p>
      </div>
      <Link
        href={`/dashboard/cvs/${cv.id}`}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Resume editing <ArrowRightIcon className="size-4" />
      </Link>
    </Card>
  );
}
