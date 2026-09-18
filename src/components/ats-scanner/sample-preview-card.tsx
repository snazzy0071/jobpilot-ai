import { CheckIcon, AlertTriangleIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreRing } from "@/components/ats-scanner/score-ring";

/**
 * reference/auth/ats-scanner.png's "SAMPLE PREVIEW" card — a clearly
 * labelled, fictional illustration of what a scan returns, shown only
 * until a real scan exists for the selected CV (see AtsScannerPanel).
 * The numbers here are made up for illustration, same as the labelled
 * fictional CV thumbnails elsewhere in this app — never presented as a
 * real result.
 */
export function SamplePreviewCard() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <ScoreRing score={84} />
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Sample preview</p>
          <h3 className="mt-0.5 font-heading text-lg font-semibold">What a real result looks like</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            A match score, which keywords landed, and specific fixes you can act on — this is what you&apos;ll see
            once you run a scan above.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            <li className="flex items-center gap-1.5 text-muted-foreground">
              <CheckIcon className="size-4 shrink-0 text-success" /> 11 of 14 keywords matched
            </li>
            <li className="flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangleIcon className="size-4 shrink-0 text-warning" /> Add stronger action verbs to two bullet
              points
            </li>
            <li className="flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangleIcon className="size-4 shrink-0 text-warning" /> Move Education above Experience for this
              role
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
