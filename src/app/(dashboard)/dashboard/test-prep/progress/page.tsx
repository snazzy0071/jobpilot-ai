import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getTestPrepInsights } from "@/lib/test-prep/analytics";
import { AccuracyTrendChart } from "@/components/test-prep/accuracy-trend-chart";
import { SubtypeHeatmap } from "@/components/test-prep/subtype-heatmap";
import { StudyPlanRecommendations } from "@/components/test-prep/study-plan-recommendations";
import { SessionsHistoryTable } from "@/components/test-prep/sessions-history-table";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * "Track improvement over time" for test prep — the same idea as the
 * interview coach's own /dashboard/interview/progress, built from this
 * one user's real completed test_sessions/test_answers
 * (src/lib/test-prep/analytics.ts), never a single session's own
 * summary in isolation.
 */
export default async function TestPrepProgressPage() {
  const user = await requireUser();
  const insights = await getTestPrepInsights(user.id);

  if (!insights.hasHistory) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/test-prep"><ArrowLeftIcon /> Test Prep</Link>} />
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Complete a practice session to start tracking your progress.</p>
          <Button className="mt-4" render={<Link href="/dashboard/test-prep">Start practicing</Link>} />
        </Card>
      </div>
    );
  }

  const trendPoints = insights.accuracyHistory.map((point) => ({
    label: formatDate(point.completedAt),
    score: point.score,
    accuracy: point.accuracy,
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/test-prep"><ArrowLeftIcon /> Test Prep</Link>} />

      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Your progress</h1>
        <p className="mt-1 text-muted-foreground">
          Score and accuracy across your {insights.accuracyHistory.length} completed practice session
          {insights.accuracyHistory.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Score &amp; accuracy over time</h2>
        <Card className="p-6">
          <AccuracyTrendChart points={trendPoints} />
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">By topic</h2>
        <Card className="p-4">
          <SubtypeHeatmap cells={insights.subtypeHeatmap} />
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Recommended next steps</h2>
        <StudyPlanRecommendations recommendations={insights.recommendations} />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Session history</h2>
        <SessionsHistoryTable history={insights.accuracyHistory} />
      </div>
    </div>
  );
}
