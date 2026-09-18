"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircleIcon, CheckCircle2Icon, ChevronLeft, ChevronRight, FlameIcon, Loader2Icon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SessionSummary } from "@/components/test-prep/session-summary";
import { submitAnswer, completeTestSession } from "@/lib/test-prep/practice/actions";
import { startDailyPractice, recordDailyCompletion } from "@/lib/test-prep/daily/actions";
import type { AnsweredState, CompleteSessionResult } from "@/lib/test-prep/practice/types";
import type { Question } from "@/lib/test-prep/types";

type CompletedSession = Extract<CompleteSessionResult, { score: number }>;

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The daily-practice flow — a fixed 5 random questions across every
 * active pack, once per local calendar day. Reuses the same generic
 * submitAnswer/completeTestSession/SessionSummary the pack-based
 * PracticeEngine uses (grading and scoring don't care whether a
 * session is tied to one pack or none), but is otherwise its own
 * component: no time limit, no pack header/description, and an extra
 * step on finish — recordDailyCompletion — that's what actually turns
 * a completed session into today's streak day.
 */
export function DailyPracticeEngine() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [alreadyDone, setAlreadyDone] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [answers, setAnswers] = useState<Map<string, AnsweredState>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [finishing, setFinishing] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [result, setResult] = useState<CompletedSession | null>(null);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) : undefined;
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = questions.filter((question) => answers.has(question.id)).length;

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    const response = await startDailyPractice({ timezone: browserTimezone() });
    setStarting(false);
    if ("error" in response) {
      setStartError(response.error);
      return;
    }
    if ("alreadyCompletedToday" in response) {
      setAlreadyDone(true);
      return;
    }
    setQuestions(response.questions);
    setSessionId(response.sessionId);
  }

  async function handleFinish() {
    if (!sessionId || finishing || result) return;
    setFinishing(true);
    const response = await completeTestSession({ testSessionId: sessionId });
    if ("error" in response) {
      setFinishing(false);
      setSubmitError(response.error);
      return;
    }
    const recordResponse = await recordDailyCompletion({ testSessionId: sessionId, timezone: browserTimezone() });
    setFinishing(false);
    if ("error" in recordResponse) setRecordError(recordResponse.error);
    setResult(response);
  }

  async function handleSubmitAnswer() {
    if (!sessionId || !currentQuestion) return;
    setSubmitting(true);
    setSubmitError(null);
    const response = await submitAnswer({
      testSessionId: sessionId,
      questionId: currentQuestion.id,
      selectedAnswer: draftAnswer || undefined,
    });
    setSubmitting(false);
    if ("error" in response) {
      setSubmitError(response.error);
      return;
    }
    if ("expired" in response) return; // daily sessions carry no time limit — unreachable in practice
    setAnswers((prev) => new Map(prev).set(currentQuestion.id, response));
  }

  function goToQuestion(index: number) {
    setCurrentIndex(index);
    setSubmitError(null);
    setDraftAnswer(answers.get(questions[index]?.id)?.selectedAnswer ?? "");
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        {recordError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> Your result was scored, but your streak couldn&apos;t be saved: {recordError}
          </p>
        )}
        <SessionSummary questions={questions} answers={answers} result={result} />
      </div>
    );
  }

  if (alreadyDone) {
    return (
      <Card className="items-center gap-3 p-10 text-center">
        <FlameIcon className="size-8 text-primary" />
        <h1 className="font-heading text-xl font-semibold">Already done for today</h1>
        <p className="max-w-md text-sm text-muted-foreground">You&apos;ve completed today&apos;s daily practice — come back tomorrow to keep your streak going.</p>
        <Button className="mt-2" render={<Link href="/dashboard/test-prep">Back to Test Prep</Link>} />
      </Card>
    );
  }

  if (!sessionId) {
    return (
      <Card className="items-center gap-3 p-10 text-center">
        <FlameIcon className="size-8 text-primary" />
        <h1 className="font-heading text-xl font-semibold">Daily Practice</h1>
        <p className="max-w-md text-sm text-muted-foreground">5 quick questions pulled from across every topic — a fast way to keep your streak alive.</p>
        {startError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {startError}
          </p>
        )}
        <Button onClick={handleStart} disabled={starting} className="mt-2">
          {starting ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Starting…
            </>
          ) : (
            "Start today's practice"
          )}
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Question {currentIndex + 1} of {questions.length} · {answeredCount} answered
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
      </div>

      <Card className="gap-4 p-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {currentQuestion.difficulty && <Badge variant="outline">{currentQuestion.difficulty}</Badge>}
          {currentQuestion.subtype && <Badge variant="outline">{currentQuestion.subtype}</Badge>}
        </div>

        <p className="text-base leading-relaxed">{currentQuestion.prompt}</p>

        {currentQuestion.questionType === "free_text" ? (
          <Textarea
            rows={4}
            maxLength={500}
            value={draftAnswer}
            onChange={(event) => setDraftAnswer(event.target.value)}
            disabled={!!currentAnswer}
            placeholder="Type your answer…"
            aria-label="Your answer"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {currentQuestion.options.map((option) => {
              const isSelectedDraft = draftAnswer === option;
              const isSelectedFinal = currentAnswer?.selectedAnswer === option;
              const showCorrectness = !!currentAnswer;
              const isTheCorrectOne = currentAnswer?.correctAnswer === option;

              let variant: "default" | "outline" | "secondary" = isSelectedDraft && !currentAnswer ? "default" : "outline";
              if (showCorrectness && isTheCorrectOne) variant = "default";
              if (showCorrectness && isSelectedFinal && !isTheCorrectOne) variant = "secondary";

              return (
                <Button
                  key={option}
                  type="button"
                  variant={variant}
                  className="h-auto justify-start px-4 py-3 text-left whitespace-normal"
                  aria-pressed={isSelectedDraft}
                  disabled={!!currentAnswer}
                  onClick={() => setDraftAnswer(option)}
                >
                  {showCorrectness && isTheCorrectOne && <CheckCircle2Icon className="size-4 shrink-0" />}
                  {showCorrectness && isSelectedFinal && !isTheCorrectOne && <XCircleIcon className="size-4 shrink-0" />}
                  {option}
                </Button>
              );
            })}
          </div>
        )}

        {currentAnswer ? (
          <div className="flex flex-col gap-1 rounded-lg border border-dashed p-3 text-sm">
            {currentAnswer.isCorrect === true && (
              <p className="flex items-center gap-1.5 font-medium text-primary">
                <CheckCircle2Icon className="size-4" /> Correct
              </p>
            )}
            {currentAnswer.isCorrect === false && (
              <p className="flex items-center gap-1.5 font-medium text-destructive">
                <XCircleIcon className="size-4" /> Not quite
              </p>
            )}
            {currentAnswer.explanation && <p className="text-muted-foreground">{currentAnswer.explanation}</p>}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={handleSubmitAnswer}
            disabled={submitting || (currentQuestion.questionType !== "free_text" && !draftAnswer)}
            className="self-start"
          >
            {submitting ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Checking…
              </>
            ) : (
              "Submit answer"
            )}
          </Button>
        )}

        {submitError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {submitError}
          </p>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={currentIndex === 0} onClick={() => goToQuestion(currentIndex - 1)}>
          <ChevronLeft className="size-4" /> Previous
        </Button>
        {isLastQuestion ? (
          <Button type="button" onClick={handleFinish} disabled={finishing}>
            {finishing ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Finishing…
              </>
            ) : (
              "Finish"
            )}
          </Button>
        ) : (
          <Button type="button" onClick={() => goToQuestion(currentIndex + 1)}>
            Next <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
