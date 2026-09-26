"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, PartyPopperIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuestionBody } from "@/components/test-prep/question-body";
import { buildSessionSummary, formatDuration } from "@/lib/test-prep/practice/summary";
import type { AnsweredState, SessionResult } from "@/lib/test-prep/practice/types";
import type { Question, TestSessionMode } from "@/lib/test-prep/types";

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
    <div className="flex flex-col gap-1" data-testid="subtype-row">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{subtype}</span>
        <span className="text-muted-foreground">
          {correct}/{answered} correct{answered < total ? ` · ${total - answered} skipped` : ""}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${subtype}: ${answered > 0 ? accuracy : 0}% accuracy`}>
        <div className={`h-full rounded-full ${accuracy < 80 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${answered > 0 ? accuracy : 0}%` }} />
      </div>
    </div>
  );
}

/**
 * The full result of a finished session: score, accuracy (a separate number from score — see summary.ts), time taken,
 * accuracy by topic, which topics to retry, and a review of every question with what you chose, the right answer and the
 * explanation. For a timed exam this is the first time any of that is shown. It is also what the history page opens for a
 * past session, so a session reads identically when you finish it and when you come back to it.
 */
export function SessionSummary({
  title,
  mode,
  questions,
  answers,
  result,
  practiceAgainHref,
}: {
  title: string;
  mode: TestSessionMode;
  questions: Question[];
  answers: Map<string, AnsweredState>;
  result: SessionResult;
  /** Omitted for the daily five (once a day) and for a review of a past session. */
  practiceAgainHref?: string;
}) {
  const summary = buildSessionSummary(questions, answers, result);
  const [filter, setFilter] = useState<"wrong" | "all">(summary.wrongAnswers.length + (questions.length - summary.answeredCount) > 0 ? "wrong" : "all");

  const reviewed = questions
    .map((question, index) => ({ question, index, answer: answers.get(question.id) }))
    .filter(({ answer }) => filter === "all" || answer?.isCorrect === false || !answer);

  return (
    <div className="flex flex-col gap-6" data-testid="session-summary">
      <Card className="items-center gap-3 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {title}
          {mode === "timed" ? " · timed exam" : ""}
        </p>
        <p className="text-sm text-muted-foreground">You scored</p>
        <p className="font-heading text-5xl font-semibold tracking-tight" data-testid="summary-score">
          {summary.score}%
        </p>
        <p className="text-sm text-muted-foreground" data-testid="summary-counts">
          {summary.correctCount} correct out of {summary.totalQuestions} · {summary.answeredCount} answered
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {practiceAgainHref && <Button render={<Link href={practiceAgainHref}>Practice again</Link>} />}
          <Button variant={practiceAgainHref ? "outline" : "default"} render={<Link href="/dashboard/test-prep">Back to Test Prep</Link>} />
          <Button variant="outline" render={<Link href="/dashboard/test-prep/progress">See your progress</Link>} />
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Score" value={`${summary.score}%`} caption={`of ${summary.totalQuestions} total`} />
        <StatTile label="Accuracy" value={`${summary.accuracy}%`} caption={`of ${summary.answeredCount} answered`} />
        <StatTile label="Time taken" value={formatDuration(summary.durationSeconds)} caption="total" />
        <StatTile label="Avg. per question" value={`${summary.averageSecondsPerQuestion}s`} caption={`across ${summary.totalQuestions}`} />
      </div>

      {summary.subtypeBreakdown.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="by-area">
          <h2 id="by-area" className="text-sm font-semibold">
            By topic
          </h2>
          <Card className="gap-4 p-4">
            {summary.subtypeBreakdown.map((entry) => (
              <SubtypeAccuracyBar key={entry.subtype} {...entry} />
            ))}
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="retry-areas">
        <h2 id="retry-areas" className="text-sm font-semibold">
          Recommended retry areas
        </h2>
        {summary.recommendedRetrySubtypes.length === 0 ? (
          <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
            <PartyPopperIcon className="size-4 shrink-0 text-primary" /> Strong result across every topic — nothing stands out to retry.
          </Card>
        ) : (
          <Card className="flex-row flex-wrap items-center gap-2 p-4">
            <AlertTriangleIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {summary.recommendedRetrySubtypes.map((subtype) => (
              <Badge key={subtype} variant="outline">
                {subtype}
              </Badge>
            ))}
          </Card>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="review">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="review" className="text-sm font-semibold">
            Review your answers
          </h2>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button type="button" size="sm" variant={filter === "wrong" ? "secondary" : "ghost"} aria-pressed={filter === "wrong"} onClick={() => setFilter("wrong")}>
              Missed ({summary.wrongAnswers.length + (questions.length - summary.answeredCount)})
            </Button>
            <Button type="button" size="sm" variant={filter === "all" ? "secondary" : "ghost"} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              All ({questions.length})
            </Button>
          </div>
        </div>

        {reviewed.length === 0 ? (
          <Card className="flex-row items-center gap-2 p-4 text-sm text-muted-foreground">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" /> Every question was answered correctly.
          </Card>
        ) : (
          reviewed.map(({ question, index, answer }) => (
            <Card key={question.id} className="gap-4 p-5" data-testid="review-item">
              <QuestionBody question={question} index={index} total={questions.length} value={answer?.selectedAnswer ?? ""} onChange={() => undefined} disabled reveal={{ correctAnswer: answer?.correctAnswer ?? null, selectedAnswer: answer?.selectedAnswer ?? null }} />
              <div className="flex flex-col gap-1 rounded-lg border border-dashed p-3 text-sm">
                {!answer || answer.selectedAnswer === null ? (
                  <p className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <AlertTriangleIcon className="size-4" aria-hidden="true" /> Not answered
                  </p>
                ) : answer.isCorrect ? (
                  <p className="flex items-center gap-1.5 font-medium text-primary">
                    <CheckCircle2Icon className="size-4" aria-hidden="true" /> You answered correctly
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 font-medium text-destructive">
                    <XCircleIcon className="size-4" aria-hidden="true" /> You answered &ldquo;{answer.selectedAnswer}&rdquo;
                  </p>
                )}
                {answer?.correctAnswer && !answer.isCorrect && <p>The answer is &ldquo;{answer.correctAnswer}&rdquo;.</p>}
                {answer?.explanation && <p className="text-muted-foreground">{answer.explanation}</p>}
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
