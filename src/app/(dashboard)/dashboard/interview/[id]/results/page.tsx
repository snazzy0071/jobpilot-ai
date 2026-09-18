import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, RefreshCwIcon, TrendingUpIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getInterviewSessionDetail } from "@/lib/interviews/queries";
import { computeCompetencyBreakdown, getWeakCompetencies } from "@/lib/interviews/results";
import { INTERVIEW_DIFFICULTY_LABELS, INTERVIEW_COMPETENCY_LABELS } from "@/lib/interviews/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CompetencyRadarChart } from "@/components/interviews/competency-radar-chart";
import { AnnotatedTranscript } from "@/components/interviews/annotated-transcript";
import { ScoreCard } from "@/components/interviews/score-card";

export const dynamic = "force-dynamic";

function scoreTone(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

/**
 * The results report for one completed interview — overall score,
 * a competency radar chart, every answer's full score breakdown, the
 * annotated transcript, and the session-level strengths/weaknesses/
 * recommended practice interviewSessionSummaryPrompt generated at
 * conclude time. Session-level fields are best-effort (a failed summary
 * generation leaves `summary` null even on a completed session), so
 * this page degrades to the parts that are always available — the
 * transcript and per-answer scores — rather than failing outright.
 */
export default async function InterviewResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const session = await getInterviewSessionDetail(user.id, id);
  if (!session) notFound();

  if (session.status !== "completed") {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={
            <Link href="/dashboard/interview">
              <ArrowLeftIcon /> All sessions
            </Link>
          }
        />
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">This interview isn&apos;t finished yet — results appear once it&apos;s complete.</p>
          <Button className="mt-4" render={<Link href={`/dashboard/interview/${session.id}`}>Continue the interview</Link>} />
        </Card>
      </div>
    );
  }

  const competencyBreakdown = computeCompetencyBreakdown(session.questions, session.scores);
  const weakCompetencies = getWeakCompetencies(competencyBreakdown);
  const scoredQuestions = session.questions.filter((question) => session.scores[question.id]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          render={
            <Link href={`/dashboard/interview/${session.id}`}>
              <ArrowLeftIcon /> Back to transcript
            </Link>
          }
        />
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href="/dashboard/interview/progress">
              <TrendingUpIcon /> View progress
            </Link>
          }
        />
      </div>

      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Results — {session.role}
          {session.company ? ` at ${session.company}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {INTERVIEW_DIFFICULTY_LABELS[session.difficulty]} · {session.questions.length} questions
        </p>
      </div>

      {weakCompetencies.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Practice your weaker areas</p>
            <p className="text-xs text-muted-foreground">
              {weakCompetencies.map((competency) => INTERVIEW_COMPETENCY_LABELS[competency]).join(", ")} scored below
              70 — start a new session focused on just these, without touching this one.
            </p>
          </div>
          <Button
            size="sm"
            render={
              <Link href={`/dashboard/interview/new?fromSessionId=${session.id}`}>
                <RefreshCwIcon /> Practice weak areas
              </Link>
            }
          />
        </Card>
      )}

      {session.summary ? (
        <Card className="flex flex-col gap-6 p-6">
          <div className="flex items-baseline gap-2">
            <span className={`text-4xl font-semibold ${scoreTone(session.summary.overallScore)}`}>
              {session.summary.overallScore}
            </span>
            <span className="text-sm text-muted-foreground">/ 100 overall</span>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Strengths</h2>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {session.summary.strengths.map((strength) => (
                  <li key={strength}>{strength}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Weaknesses</h2>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {session.summary.weaknesses.map((weakness) => (
                  <li key={weakness}>{weakness}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Recommended practice</h2>
            <ul className="list-disc space-y-1 pl-4 text-sm">
              {session.summary.recommendedPractice.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          A session-level summary couldn&apos;t be generated for this interview — the per-answer scores and
          transcript below are still complete.
        </Card>
      )}

      {competencyBreakdown.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Competency breakdown</h2>
          <Card className="p-6">
            <CompetencyRadarChart data={competencyBreakdown} />
          </Card>
        </div>
      )}

      {scoredQuestions.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Per-answer scores</h2>
          <div className="flex flex-col gap-4">
            {scoredQuestions.map((question) => (
              <div key={question.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{question.question}</p>
                  <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                    {INTERVIEW_COMPETENCY_LABELS[question.competency]}
                  </Badge>
                </div>
                <ScoreCard score={session.scores[question.id]} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Full transcript</h2>
        <AnnotatedTranscript transcript={session.transcript} questions={session.questions} scores={session.scores} />
      </div>
    </div>
  );
}
