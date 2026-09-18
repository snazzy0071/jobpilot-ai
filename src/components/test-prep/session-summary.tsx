import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, PartyPopperIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildSessionSummary, formatDuration } from "@/lib/test-prep/practice/summary";
import type { AnsweredState, CompleteSessionResult } from "@/lib/test-prep/practice/types";
import type { Question, QuestionPack } from "@/lib/test-prep/types";

function StatTile({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <Card className="items-center gap-1 p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}

function SubtypeAccuracyBar({ subtype, total, answered, correct, accuracy }: { subtype: string; total: number; answered: number; correct: number; accuracy: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{subtype}</span>
        <span className="text-muted-foreground">
          {correct}/{answered} correct{answered < total ? ` · ${total - answered} skipped` : ""}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${accuracy < 80 ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${answered > 0 ? accuracy : 0}%` }}
        />
      </div>
    </div>
  );
}

type CompletedSession = Extract<CompleteSessionResult, { score: number }>;

/**
 * The full post-attempt summary: score, accuracy (a distinct number
 * from score — see summary.ts's own comment on why), timing, a
 * per-subtype accuracy breakdown, which subtypes to retry, and the
 * explanations for whatever was actually answered wrong. Everything
 * here is derived by `buildSessionSummary` from data the practice
 * engine already holds — no second fetch, and never a privileged one.
 */
export function SessionSummary({
  pack,
  questions,
  answers,
  result,
}: {
  /** Omitted for a daily-practice session — it isn't scoped to one pack, and (being once-per-day) has nothing to "practice again" right now. */
  pack?: QuestionPack;
  questions: Question[];
  answers: Map<string, AnsweredState>;
  result: CompletedSession;
}) {
  const summary = buildSessionSummary(questions, answers, result);

  return (
    <div className="flex flex-col gap-6">
      <Card className="items-center gap-3 p-10 text-center">
        <p className="text-sm text-muted-foreground">You scored</p>
        <p className="font-heading text-5xl font-semibold tracking-tight">{summary.score}%</p>
        <p className="text-sm text-muted-foreground">
          {summary.correctCount} correct out of {summary.totalQuestions} · {summary.answeredCount} answered
        </p>
        <Button
          className="mt-4"
          render={
            pack ? (
              <Link href={`/dashboard/test-prep/practice/${pack.id}`}>Practice again</Link>
            ) : (
              <Link href="/dashboard/test-prep">Back to Test Prep</Link>
            )
          }
        />
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Score" value={`${summary.score}%`} caption={`of ${summary.totalQuestions} total`} />
        <StatTile label="Accuracy" value={`${summary.accuracy}%`} caption={`of ${summary.answeredCount} answered`} />
        <StatTile label="Time taken" value={formatDuration(summary.durationSeconds)} caption="total" />
        <StatTile label="Avg. per question" value={`${summary.averageSecondsPerQuestion}s`} caption={`across ${summary.totalQuestions}`} />
      </div>

      {summary.subtypeBreakdown.length > 1 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">By area</h2>
          <Card className="gap-4 p-4">
            {summary.subtypeBreakdown.map((entry) => (
              <SubtypeAccuracyBar key={entry.subtype} {...entry} />
            ))}
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Recommended retry areas</h2>
        {summary.recommendedRetrySubtypes.length === 0 ? (
          <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
            <PartyPopperIcon className="size-4 shrink-0 text-primary" /> Strong result across every area — nothing stands out to retry.
          </Card>
        ) : (
          <Card className="flex-row flex-wrap items-center gap-2 p-4">
            <AlertTriangleIcon className="size-4 shrink-0 text-muted-foreground" />
            {summary.recommendedRetrySubtypes.map((subtype) => (
              <Badge key={subtype} variant="outline">
                {subtype}
              </Badge>
            ))}
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Wrong answers</h2>
        {summary.wrongAnswers.length === 0 ? (
          <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" /> Every answered question was correct.
          </Card>
        ) : (
          summary.wrongAnswers.map((wrong, index) => (
            <Card key={wrong.questionId} className="gap-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium">
                  {index + 1}. {wrong.prompt}
                </p>
                {wrong.subtype && (
                  <Badge variant="outline" className="shrink-0">
                    {wrong.subtype}
                  </Badge>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <XCircleIcon className="size-4 shrink-0" /> You answered &ldquo;{wrong.selectedAnswer}&rdquo;
                {wrong.correctAnswer && ` — correct answer: "${wrong.correctAnswer}"`}
              </p>
              {wrong.explanation && <p className="text-sm text-muted-foreground">{wrong.explanation}</p>}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
