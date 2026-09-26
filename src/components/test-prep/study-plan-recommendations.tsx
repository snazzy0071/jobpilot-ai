import Link from "next/link";
import { PartyPopperIcon, SparklesIcon, TargetIcon, TimerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { StudyRecommendation } from "@/lib/test-prep/analytics";

/**
 * Recommended practice, from actual performance (src/lib/test-prep/analytics.ts) — nothing is AI-generated:
 *   1. a weak topic (enough answers, accuracy under the threshold) -> a focused session on exactly that topic;
 *   2. a test format never attempted -> go and try it;
 *   3. a format you're consistently good at -> sit it as a timed exam.
 */
export function StudyPlanRecommendations({ recommendations }: { recommendations: StudyRecommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground" data-testid="recommendations-empty">
        <PartyPopperIcon className="size-4 shrink-0 text-primary" /> No weak spots or untried formats right now — solid coverage across the board.
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="recommendations">
      {recommendations.map((recommendation) => {
        if (recommendation.kind === "weak_subtype") {
          return (
            <li key={`weak-${recommendation.testTypeId}-${recommendation.subtype}`}>
              <Card className="flex-row items-center justify-between gap-3 p-4" data-testid="recommendation-weak">
                <div className="flex items-start gap-3">
                  <TargetIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Strengthen {recommendation.subtype}</p>
                    <p className="text-xs text-muted-foreground">
                      {recommendation.accuracy}% accuracy over {recommendation.sampleSize} question{recommendation.sampleSize === 1 ? "" : "s"}
                      {recommendation.testTypeName ? ` · ${recommendation.testTypeName}` : ""}
                      {recommendation.trend ? ` · ${recommendation.trend}` : ""}
                    </p>
                  </div>
                </div>
                <Button size="sm" render={<Link href={`/dashboard/test-prep/focus?type=${recommendation.testTypeId}&subtype=${encodeURIComponent(recommendation.subtype)}`}>Practise this</Link>} />
              </Card>
            </li>
          );
        }
        if (recommendation.kind === "try_timed") {
          return (
            <li key={`timed-${recommendation.testTypeId}`}>
              <Card className="flex-row items-center justify-between gap-3 p-4" data-testid="recommendation-timed">
                <div className="flex items-start gap-3">
                  <TimerIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">Sit a timed {recommendation.testTypeName} exam</p>
                    <p className="text-xs text-muted-foreground">You&apos;re at {recommendation.accuracy}% here — ready to try it against the clock.</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" render={<Link href={`/dashboard/test-prep#${recommendation.testTypeId}`}>Choose a pack</Link>} />
              </Card>
            </li>
          );
        }
        return (
          <li key={`untried-${recommendation.testTypeId}`}>
            <Card className="flex-row items-center justify-between gap-3 p-4" data-testid="recommendation-untried">
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">{recommendation.testTypeName}</p>
                  <p className="text-xs text-muted-foreground">Not attempted yet</p>
                </div>
              </div>
              <Button size="sm" variant="outline" render={<Link href={`/dashboard/test-prep#${recommendation.testTypeId}`}>Try it</Link>} />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
