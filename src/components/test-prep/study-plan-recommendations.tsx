import Link from "next/link";
import { PartyPopperIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StudyRecommendation } from "@/lib/test-prep/analytics";

/**
 * "Personalized study-plan recommendations from actual performance" —
 * every entry here is either a real weak subtype (below-threshold
 * accuracy over a real sample, src/lib/test-prep/analytics.ts) or a
 * test type this user has genuinely never attempted; nothing is
 * AI-generated. Weak subtypes come first (the more specific, more
 * actionable signal), then untried types.
 */
export function StudyPlanRecommendations({ recommendations }: { recommendations: StudyRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
        <PartyPopperIcon className="size-4 shrink-0 text-primary" /> No weak spots or untried areas right now — solid coverage across the board.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {recommendations.map((recommendation, index) => {
        if (recommendation.kind === "weak_subtype") {
          return (
            <Card key={`weak-${recommendation.subtype}-${index}`} className="flex-row items-center justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{recommendation.subtype}</p>
                  <p className="text-xs text-muted-foreground">
                    {recommendation.accuracy}% accuracy over {recommendation.sampleSize} question{recommendation.sampleSize === 1 ? "" : "s"}
                    {recommendation.testTypeName ? ` · ${recommendation.testTypeName}` : ""}
                  </p>
                </div>
              </div>
              {recommendation.packId && (
                <Button size="sm" variant="outline" render={<Link href={`/dashboard/test-prep/practice/${recommendation.packId}`}>Retry</Link>} />
              )}
            </Card>
          );
        }

        return (
          <Card key={`untried-${recommendation.testTypeId}`} className="flex-row items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{recommendation.testTypeName}</p>
                <p className="text-xs text-muted-foreground">Not attempted yet</p>
              </div>
            </div>
            <Button size="sm" variant="outline" render={<Link href={`/dashboard/test-prep#${recommendation.testTypeId}`}>Try it</Link>} />
          </Card>
        );
      })}
    </div>
  );
}
