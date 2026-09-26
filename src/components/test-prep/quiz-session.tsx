"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, ChevronLeft, ChevronRight, FlagIcon, Loader2Icon, Timer, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuestionBody } from "@/components/test-prep/question-body";
import { SessionSummary } from "@/components/test-prep/session-summary";
import { completeTestSession, submitAnswer } from "@/lib/test-prep/practice/actions";
import { recordDailyCompletion } from "@/lib/test-prep/daily/actions";
import { formatDuration } from "@/lib/test-prep/practice/summary";
import { isAnsweredState, type AnsweredState, type StartedSession } from "@/lib/test-prep/practice/types";
import type { Question } from "@/lib/test-prep/types";

type Finished = { questions: Question[]; answers: AnsweredState[]; correctCount: number; answeredCount: number; totalQuestions: number; score: number; startedAt: string; completedAt: string };

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * The one quiz engine for every way of practising — a pack (practice or timed), the daily five, or focused practice. It
 * renders the questions the SERVER set for this session and never chooses or shuffles anything itself.
 *
 * Practice mode: submit an answer, see at once whether it was right and why; that answer is then locked. Timed mode: an
 * exam. Choosing an option stores it at once (so nothing is lost if the clock runs out), you can move freely and change
 * answers, and you're told nothing about correctness until you finish — the server doesn't send the key until then. The
 * countdown is only a display of the deadline the server recorded when the session started; every answer is re-checked
 * against that deadline server-side, so a stopped clock or an edited page doesn't buy extra time.
 */
export function QuizSession({
  session,
  title,
  practiceAgainHref,
  isDaily = false,
}: {
  session: StartedSession;
  title: string;
  /** Where "Practice again" goes on the results screen; omitted for the daily five (once a day). */
  practiceAgainHref?: string;
  isDaily?: boolean;
}) {
  const { questions, mode, sessionId, expiresAt } = session;
  const timed = mode === "timed";

  const [index, setIndex] = useState(0);
  // Practice: answers already graded (locked, with feedback). Timed: the option chosen so far per question.
  const [graded, setGraded] = useState<Map<string, AnsweredState>>(() => new Map(session.answers.map((answer) => [answer.questionId, answer])));
  const [chosen, setChosen] = useState<Map<string, string>>(() => new Map(session.savedAnswers.map((answer) => [answer.questionId, answer.selectedAnswer ?? ""])));
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => (expiresAt ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)) : null));
  const finishedOnce = useRef(false);
  const heading = useRef<HTMLDivElement>(null);

  const question = questions[index];
  const gradedAnswer = question ? graded.get(question.id) : undefined;
  const answeredCount = useMemo(
    () => questions.filter((item) => (timed ? (chosen.get(item.id) ?? "") !== "" : graded.has(item.id))).length,
    [questions, chosen, graded, timed],
  );

  const finish = useCallback(async () => {
    if (finishedOnce.current) return;
    finishedOnce.current = true;
    setFinishing(true);
    setError(null);
    const response = await completeTestSession({ testSessionId: sessionId });
    if ("error" in response) {
      finishedOnce.current = false; // let them try again
      setFinishing(false);
      setError(response.error);
      return;
    }
    if (isDaily) {
      const recorded = await recordDailyCompletion({ testSessionId: sessionId, timezone: browserTimezone() });
      if ("error" in recorded) setRecordError(recorded.error);
    }
    setFinishing(false);
    setFinished(response);
  }, [sessionId, isDaily]);

  // The countdown: recomputed from the server's deadline each tick, never decremented locally, so it can't drift.
  useEffect(() => {
    if (!expiresAt || finished) return;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) void finish();
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, finished, finish]);

  function goTo(next: number) {
    setIndex(next);
    setError(null);
    const target = questions[next];
    setDraft(timed ? (chosen.get(target.id) ?? "") : (graded.get(target.id)?.selectedAnswer ?? ""));
    heading.current?.focus();
  }

  async function save(questionId: string, answer: string) {
    setSubmitting(true);
    setError(null);
    const response = await submitAnswer({ testSessionId: sessionId, questionId, selectedAnswer: answer || undefined });
    setSubmitting(false);
    if ("error" in response) {
      setError(response.error);
      return false;
    }
    if ("expired" in response) {
      void finish();
      return false;
    }
    if (isAnsweredState(response)) setGraded((previous) => new Map(previous).set(response.questionId, response));
    return true;
  }

  async function handleChoose(value: string) {
    setDraft(value);
    if (timed && question) {
      const previous = chosen.get(question.id) ?? "";
      setChosen((map) => new Map(map).set(question.id, value));
      const ok = await save(question.id, value);
      if (!ok) setChosen((map) => new Map(map).set(question.id, previous)); // never claim an answer that wasn't stored
    }
  }

  if (finished) {
    return (
      <div className="flex flex-col gap-4">
        {recordError && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> Your result was scored, but your streak couldn&apos;t be saved: {recordError}
          </p>
        )}
        <SessionSummary title={title} mode={mode} questions={finished.questions} answers={new Map(finished.answers.map((answer) => [answer.questionId, answer]))} result={finished} practiceAgainHref={practiceAgainHref} />
      </div>
    );
  }

  if (finishing && secondsLeft === 0) {
    return (
      <Card className="items-center gap-3 p-10 text-center" role="status">
        <Loader2Icon className="size-6 animate-spin text-primary" />
        <p className="font-medium">Time&apos;s up — marking your answers…</p>
      </Card>
    );
  }

  const lowTime = secondsLeft !== null && secondsLeft <= 60;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground" data-testid="quiz-progress">
            {answeredCount} of {questions.length} answered{timed ? " · timed exam" : ""}
          </p>
        </div>
        {secondsLeft !== null && (
          <span className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold tabular-nums ${lowTime ? "border-destructive text-destructive" : ""}`} data-testid="quiz-timer">
            <Timer className="size-4" aria-hidden="true" /> {formatDuration(secondsLeft)}
            <span className="sr-only"> remaining</span>
          </span>
        )}
      </div>
      {/* Announced politely at the thresholds only — a per-second announcement would drown the question. */}
      <p className="sr-only" role="status" aria-live="polite">
        {secondsLeft === 300 ? "5 minutes remaining" : secondsLeft === 60 ? "1 minute remaining" : secondsLeft === 10 ? "10 seconds remaining" : ""}
      </p>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
      </div>

      {timed && (
        <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
          {questions.map((item, itemIndex) => {
            const done = (chosen.get(item.id) ?? "") !== "";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(itemIndex)}
                aria-label={`Question ${itemIndex + 1}, ${done ? "answered" : "not answered"}${itemIndex === index ? ", current" : ""}`}
                aria-current={itemIndex === index ? "step" : undefined}
                className={`size-8 rounded-md border text-xs font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${itemIndex === index ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/50 bg-primary/10" : "border-input"}`}
              >
                {itemIndex + 1}
              </button>
            );
          })}
        </nav>
      )}

      <Card className="gap-4 p-6">
        <div ref={heading} tabIndex={-1} className="outline-none">
          <QuestionBody
            question={question}
            index={index}
            total={questions.length}
            value={timed ? (chosen.get(question.id) ?? "") : gradedAnswer ? (gradedAnswer.selectedAnswer ?? "") : draft}
            onChange={handleChoose}
            disabled={submitting || (!timed && !!gradedAnswer)}
            reveal={!timed && gradedAnswer ? { correctAnswer: gradedAnswer.correctAnswer, selectedAnswer: gradedAnswer.selectedAnswer } : null}
          />
        </div>

        {!timed &&
          (gradedAnswer ? (
            <div className="flex flex-col gap-1 rounded-lg border border-dashed p-3 text-sm" role="status" data-testid="answer-feedback">
              {gradedAnswer.isCorrect === true && (
                <p className="flex items-center gap-1.5 font-medium text-primary">
                  <CheckCircle2Icon className="size-4" aria-hidden="true" /> Correct
                </p>
              )}
              {gradedAnswer.isCorrect === false && (
                <p className="flex items-center gap-1.5 font-medium text-destructive">
                  <XCircleIcon className="size-4" aria-hidden="true" /> Not quite
                  {gradedAnswer.correctAnswer && <span className="font-normal text-foreground"> — the answer is &ldquo;{gradedAnswer.correctAnswer}&rdquo;</span>}
                </p>
              )}
              {gradedAnswer.explanation && <p className="text-muted-foreground">{gradedAnswer.explanation}</p>}
            </div>
          ) : (
            <Button type="button" variant="outline" className="self-start" onClick={() => void save(question.id, draft)} disabled={submitting || (question.questionType !== "free_text" && !draft)}>
              {submitting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" /> Checking…
                </>
              ) : (
                "Submit answer"
              )}
            </Button>
          ))}

        {timed && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            {submitting ? (
              <>
                <Loader2Icon className="size-3 animate-spin" /> Saving…
              </>
            ) : (chosen.get(question.id) ?? "") !== "" ? (
              <>
                <CheckCircle2Icon className="size-3" aria-hidden="true" /> Answer saved — you can change it until you finish.
              </>
            ) : (
              <>
                <FlagIcon className="size-3" aria-hidden="true" /> Not answered yet. Answers and explanations appear when you finish.
              </>
            )}
          </p>
        )}

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}
      </Card>

      {confirmFinish && (
        <Card className="gap-3 border-destructive/40 p-4" role="alertdialog" aria-label="Finish the exam?">
          <p className="text-sm font-medium">
            Finish now? {questions.length - answeredCount > 0 ? `${questions.length - answeredCount} question${questions.length - answeredCount === 1 ? " is" : "s are"} unanswered and will count against your score.` : "You have answered every question."}
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void finish()} disabled={finishing}>
              {finishing ? <Loader2Icon className="size-4 animate-spin" /> : null} Yes, finish
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmFinish(false)}>
              Keep going
            </Button>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={index === 0} onClick={() => goTo(index - 1)}>
          <ChevronLeft className="size-4" /> Previous
        </Button>
        <div className="flex items-center gap-2">
          {index < questions.length - 1 && (
            <Button type="button" variant={timed ? "outline" : "default"} onClick={() => goTo(index + 1)}>
              Next <ChevronRight className="size-4" />
            </Button>
          )}
          {(timed || index === questions.length - 1) && (
            <Button
              type="button"
              onClick={() => (timed ? setConfirmFinish(true) : void finish())}
              disabled={finishing}
            >
              {finishing ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" /> Finishing…
                </>
              ) : (
                "Finish"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
