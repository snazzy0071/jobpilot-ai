import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { scoreTone } from "@/lib/quick-scan/score-tone";
import type { CvListItem } from "@/lib/cvs/types";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  return `Updated ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

/**
 * reference/auth/ats-scanner.png's "Which CV are we scanning?" grid —
 * plain text cards (title, updated-at, a real ats_score badge or "Never
 * scanned"), selection driven by a `?cvId=` query param so picking a
 * card is just a link, no client state needed. The reference doesn't
 * show CV thumbnails here (unlike the CV list page), so this stays
 * text-only, matching it.
 */
export function CvPicker({ cvs, selectedCvId }: { cvs: CvListItem[]; selectedCvId: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl font-semibold">Which CV are we scanning?</h2>
          <p className="text-sm text-muted-foreground">
            {cvs.length} {cvs.length === 1 ? "CV" : "CVs"} in your library
          </p>
        </div>
        <Link href="/dashboard/cvs" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
          Manage CVs <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {cvs.map((cv) => {
          const selected = cv.id === selectedCvId;
          return (
            <Link
              key={cv.id}
              href={`/dashboard/ats-scanner?cvId=${cv.id}`}
              className={`flex flex-col gap-1 rounded-xl border p-4 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              <span className="line-clamp-1 font-heading text-sm font-semibold">{cv.title}</span>
              <span className={`text-xs ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {formatUpdatedAt(cv.updatedAt)}
              </span>
              {cv.atsScore === null ? (
                <Badge
                  variant={selected ? "secondary" : "outline"}
                  className={`mt-1 w-fit text-[10px] ${selected ? "" : "text-muted-foreground"}`}
                >
                  Never scanned
                </Badge>
              ) : (
                <Badge
                  variant={selected ? "secondary" : "outline"}
                  className={`mt-1 w-fit text-[10px] font-semibold ${selected ? "" : scoreTone(cv.atsScore)}`}
                >
                  {cv.atsScore}/100
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
