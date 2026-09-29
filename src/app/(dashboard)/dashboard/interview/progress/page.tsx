import Link from "next/link";
import { ArrowLeftIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getInterviewProgress } from "@/lib/interviews/queries";
import { INTERVIEW_COMPETENCY_LABELS } from "@/lib/interviews/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScoreTrendChart } from "@/components/interviews/score-trend-chart";

export const dynamic = "force-dynamic";

function deltaTone(delta: number): string {
  if (delta > 0) return "text-success";
  if (delta < 0) return "text-destructive";
  return "text-muted-foreground";
}

function DeltaBadge({ delta }: { delta: number }) {
  const Icon = delta > 0 ? TrendingUpIcon : delta < 0 ? TrendingDownIcon : MinusIcon;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${deltaTone(delta)}`}>
      <Icon className="size-4" />
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * "Track improvement over time" — an overall-score trend across every
 * completed session plus, per competency, the first score practiced vs.
 * the latest, so a user can see whether re-practising a weak area
 * (results page's "Practice weak areas") actually moved the needle.
 * Nothing here is computed from a single session in isolation; it's
 * always a read across every completed session the user has.
 */
export default async function InterviewProgressPage() {
  const user = await requireUser();
  const progress = await getInterviewProgress(user.id);

  const scoredSessions = progress.sessions.filter(
    (session): session is typeof session & { overallScore: number } => session.overallScore !== null,
  );
  const trendPoints = scoredSessions.map((session) => ({
    label: formatDate(session.completedAt),
    score: session.overallScore,
  }));

  const practicedCompetencies = progress.competencies.filter((entry) => entry.history.length > 1);
  const singlePassCompetencies = progress.competencies.filter((entry) => entry.history.length === 1);

  if (progress.sessions.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/interview"><ArrowLeftIcon /> All sessions</Link>} />
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Complete a mock interview to start tracking your progress.</p>
          <Button className="mt-4" render={<Link href="/dashboard/interview/new">Start a mock interview</Link>} />
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/interview"><ArrowLeftIcon /> All sessions</Link>} />

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Overall score</h2>
        <Card className="p-6">
          <ScoreTrendChart points={trendPoints} />
        </Card>
      </div>

      {practicedCompetencies.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Competencies you&apos;ve re-practised</h2>
          <Card className="divide-y">
            {practicedCompetencies
              .sort((a, b) => b.delta - a.delta)
              .map((entry) => (
                <div key={entry.competency} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-sm font-medium">{INTERVIEW_COMPETENCY_LABELS[entry.competency]}</p>
                    <p className="text-xs text-muted-foreground">
                      Practised {entry.history.length} times · {entry.firstScore} → {entry.latestScore}
                    </p>
                  </div>
                  <DeltaBadge delta={entry.delta} />
                </div>
              ))}
          </Card>
        </div>
      )}

      {singlePassCompetencies.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Practised once so far</h2>
          <Card className="divide-y">
            {singlePassCompetencies
              .sort((a, b) => a.latestScore - b.latestScore)
              .map((entry) => (
                <div key={entry.competency} className="flex items-center justify-between gap-4 p-4">
                  <p className="text-sm font-medium">{INTERVIEW_COMPETENCY_LABELS[entry.competency]}</p>
                  <span className="text-sm text-muted-foreground">{entry.latestScore} / 100</span>
                </div>
              ))}
          </Card>
        </div>
      )}
    </div>
  );
}
