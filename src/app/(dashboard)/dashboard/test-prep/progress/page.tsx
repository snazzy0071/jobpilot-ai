import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { hasTestPrepAccess } from "@/lib/test-prep/access";
import { getTestPrepInsights } from "@/lib/test-prep/analytics";
import { getPackQuestionCounts, listActiveTestTypes } from "@/lib/test-prep/queries";
import { AccuracyTrendChart } from "@/components/test-prep/accuracy-trend-chart";
import { LockedTestPrep } from "@/components/test-prep/locked-test-prep";
import { TopicAccuracyTable } from "@/components/test-prep/topic-accuracy-table";
import { StudyPlanRecommendations } from "@/components/test-prep/study-plan-recommendations";
import { SessionsHistoryTable } from "@/components/test-prep/sessions-history-table";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Tile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <Card className="items-center gap-1 p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}

/**
 * "Track improvement over time" for test prep: built from this one user's real completed sessions and answers
 * (src/lib/test-prep/analytics.ts). Accuracy by format and by topic, weak areas with their trend, recommended focused
 * practice, and every past session with a full review.
 */
export default async function TestPrepProgressPage() {
  const user = await requireUser();

  if (!(await hasTestPrepAccess(user.id))) {
    const [types, counts] = await Promise.all([listActiveTestTypes(), getPackQuestionCounts()]);
    return <LockedTestPrep typeCount={types.length} questionCount={[...counts.values()].reduce((sum, count) => sum + count, 0)} />;
  }

  const insights = await getTestPrepInsights(user.id);

  if (!insights.hasHistory) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/test-prep"><ArrowLeftIcon /> Test Prep</Link>} />
        <Card className="p-8 text-center" data-testid="progress-empty">
          <p className="text-muted-foreground">Complete a practice session to start tracking your progress.</p>
          <Button className="mt-4" render={<Link href="/dashboard/test-prep">Start practicing</Link>} />
        </Card>
      </div>
    );
  }

  const trendPoints = insights.accuracyHistory.slice(-30).map((point) => ({ label: formatDate(point.completedAt), score: point.score, accuracy: point.accuracy }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/test-prep"><ArrowLeftIcon /> Test Prep</Link>} />

      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Your progress</h1>
        <p className="mt-1 text-muted-foreground">
          Across your {insights.totals.sessions} completed practice session{insights.totals.sessions === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Sessions" value={String(insights.totals.sessions)} />
        <Tile label="Questions answered" value={String(insights.totals.answers)} />
        <Tile label="Overall accuracy" value={insights.totals.accuracy !== null ? `${insights.totals.accuracy}%` : "—"} />
      </div>

      <section aria-labelledby="recommended">
        <h2 id="recommended" className="mb-4 text-lg font-semibold tracking-tight">
          Recommended practice
        </h2>
        <StudyPlanRecommendations recommendations={insights.recommendations} />
      </section>

      <section aria-labelledby="by-format">
        <h2 id="by-format" className="mb-4 text-lg font-semibold tracking-tight">
          By test format
        </h2>
        <Card className="divide-y p-0" data-testid="type-accuracy">
          {insights.byType.map((type) => (
            <div key={type.testTypeId} className="flex flex-wrap items-center justify-between gap-2 p-4" data-testid="type-accuracy-row">
              <p className="text-sm font-medium">{type.name}</p>
              <p className="text-sm text-muted-foreground">
                {type.answers === 0 ? "Not attempted" : `${type.accuracy}% accuracy over ${type.answers} answer${type.answers === 1 ? "" : "s"}${type.bestScore !== null ? ` · best pack score ${type.bestScore}%` : ""}`}
              </p>
            </div>
          ))}
        </Card>
      </section>

      <section aria-labelledby="over-time">
        <h2 id="over-time" className="mb-4 text-lg font-semibold tracking-tight">
          Score &amp; accuracy over time
        </h2>
        <Card className="p-6">
          <AccuracyTrendChart points={trendPoints} />
        </Card>
      </section>

      <section aria-labelledby="by-topic">
        <h2 id="by-topic" className="mb-4 text-lg font-semibold tracking-tight">
          Accuracy by topic
        </h2>
        <TopicAccuracyTable topics={insights.topics} />
      </section>

      <section aria-labelledby="history">
        <h2 id="history" className="mb-4 text-lg font-semibold tracking-tight">
          Session history
        </h2>
        <SessionsHistoryTable history={insights.accuracyHistory} />
      </section>
    </div>
  );
}
