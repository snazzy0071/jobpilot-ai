import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildAtsRecommendations, groupAtsRecommendations, RECOMMENDATION_GROUP_LABELS } from "@/lib/cvs/ats-recommendations";
import { sectionAnchorId } from "@/components/cvs/editor/jump-to-section";
import { SECTION_LABELS } from "@/lib/cvs/types";
import type { CvAtsFixPriority, CvAtsFormatIssue, CvAtsScan } from "@/lib/cvs/types";

const PRIORITY_BADGE_VARIANT: Record<CvAtsFixPriority, "destructive" | "outline" | "secondary"> = {
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

/**
 * The scan's prioritized fixes and missing-keyword gaps, grouped by CV section. Shared by both ATS
 * Scanner entry points. `cvId` is the one thing that differs between them: a scan against a saved CV can
 * deep-link "Fix in {section}" straight to that CV's editor (`formatIssues` — the CV's own live,
 * deterministic checks — only ever exist for that path too); a scan of an uploaded/pasted CV has no CV to
 * link to, so `cvId` is null and each item is shown as plain, unlinked text instead.
 */
export function RecommendationsCard({
  scan,
  formatIssues = [],
  cvId,
}: {
  scan: CvAtsScan;
  formatIssues?: CvAtsFormatIssue[];
  cvId: string | null;
}) {
  const recommendationBuckets = groupAtsRecommendations(buildAtsRecommendations(formatIssues, scan));
  if (recommendationBuckets.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendations</CardTitle>
        <CardDescription>{cvId ? "Apply these in the editor, then come back and re-score." : "Build these into a CV, then scan it again to see the score improve."}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {recommendationBuckets.map(({ group, items }) => (
          <div key={group}>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              {RECOMMENDATION_GROUP_LABELS[group]} ({items.length})
            </p>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-2.5 text-sm">
                  <span className="flex items-start gap-2">
                    <Badge variant={PRIORITY_BADGE_VARIANT[item.priority]} className="mt-0.5 shrink-0 capitalize">
                      {item.priority}
                    </Badge>
                    {item.message}
                  </span>
                  {cvId && item.jumpSectionKey && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      render={
                        <Link href={`/dashboard/cvs/${cvId}#${sectionAnchorId(item.jumpSectionKey)}`}>
                          Fix in {SECTION_LABELS[item.jumpSectionKey]}
                        </Link>
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
