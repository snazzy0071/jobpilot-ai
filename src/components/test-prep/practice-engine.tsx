"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, ChevronLeft, ChevronRight, Loader2Icon, Timer, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SessionSummary } from "@/components/test-prep/session-summary";
import { startTestSession, submitAnswer, completeTestSession } from "@/lib/test-prep/practice/actions";
import { formatDuration } from "@/lib/test-prep/practice/summary";
import type { AnsweredState, CompleteSessionResult } from "@/lib/test-prep/practice/types";
import type { Question, QuestionPack } from "@/lib/test-prep/types";

type CompletedSession = Extract<CompleteSessionResult, { score: number }>;

/**
 * One reusable engine for all five test-prep formats
 * (src/lib/test-prep/types.ts's five seeded test_types) — it never
 * branches on *which* format it's rendering, only on the generic
 * `question.questionType` (`multiple_choice`/`true_false`/
 * `free_text`), which is exactly what lets the same component serve
 * Critical Thinking, SJT, Numerical, Verbal, and Diagrammatic packs
 * without a single format-specific code path. `true_false` renders
 * identically to `multiple_choice` (it's just options with exactly two
 * entries) — there's deliberately no separate branch for it.
 *
 * Navigation rules: one question on screen at a time, a real progress
 * bar, "Previous" always available (this is practice, not a proctored
 * exam — an answer stays editable, re-submitting just upserts the same
 * `test_answers` row), "Next" always available too (skipping without
 * answering is allowed, not blocked), and "Finish" only appears on the
 * last question. A time limit (`pack.timeLimitSeconds`, when set)
 * counts down and auto-finishes at zero rather than locking further
 * input silently.
 *
 * Answer persistence: every submit goes to the server immediately
 * (submitAnswer), not batched at the end — a browser refresh mid-
 * session loses the in-progress *view* (which question you were on),
 * but never a submitted answer, since it's already durably stored by
 * the time this component's own state advances past it. Resuming an
 * abandoned, never-completed session isn't built here — a real
 * feature, but a separate one from "take a session start to finish".
 */
export function PracticeEngine({ pack, questions }: { pack: QuestionPack; questions: Question[] }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [answers, setAnswers] = useState<Map<string, AnsweredState>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<CompletedSession | null>(null);

  // The deadline itself comes from the server (startTestSession's own
  // `expires_at` snapshot, migration 0070) — `secondsLeft` is only ever
  // a display recomputed from it each tick, never a locally-decremented
  // guess, so a backgrounded tab or a stalled timer can't drift the
  // shown countdown away from what the server will actually enforce.
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers.get(currentQuestion.id) : undefined;
  const isLastQuestion = currentIndex === questions.length - 1;

  async function handleFinish() {
    if (!sessionId || finishing || result) return;
    setFinishing(true);
    const response = await completeTestSession({ testSessionId: sessionId });
    setFinishing(false);
    if ("error" in response) {
      setSubmitError(response.error);
      return;
    }
    setResult(response);
  }

  // Counts down once a session is running and has a real deadline —
  // auto-finishes at zero instead of just freezing input, so a learner
  // always gets a real result rather than a stuck screen. Each tick
  // recomputes the remaining time from `expiresAt` (the server's own
  // deadline) rather than decrementing the previous value, so the
  // display self-corrects instead of drifting. The actual enforcement
  // still happens server-side in submitAnswer — this timer only decides
  // when to *proactively* call finish; a late submit that slips through
  // anyway comes back as `{ expired: true }` and is handled there too.
  useEffect(() => {
    if (!expiresAt || !sessionId || result) return;
    if (secondsLeft !== null && secondsLeft <= 0) {
      // Deferred to a macrotask rather than called directly here —
      // handleFinish's first synchronous action is a setState call,
      // and calling that straight from an effect body risks a
      // cascading render (React's own react-hooks/purity rule caught
      // this in an earlier draft); a zero-delay setTimeout breaks that
      // direct chain without changing the actual behaviour.
      const finish = setTimeout(() => void handleFinish(), 0);
      return () => clearTimeout(finish);
    }
    const timeout = setTimeout(() => {
      setSecondsLeft(Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    }, 1000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, expiresAt, sessionId, result]);

  async function handleStart() {
    setStarting(true);
    setStartError(null);
    const response = await startTestSession({ questionPackId: pack.id });
    setStarting(false);
    if ("error" in response) {
      setStartError(response.error);
      return;
    }
    setExpiresAt(response.expiresAt);
    setSecondsLeft(response.expiresAt ? Math.max(0, Math.round((new Date(response.expiresAt).getTime() - Date.now()) / 1000)) : null);
    setSessionId(response.sessionId);
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
    if ("expired" in response) {
      // The server's own deadline had already passed when this arrived
      // — nothing was graded or stored. The client-side timer should
      // have already triggered finish itself by this point; this is
      // just the fallback for the rare race where a submit was in
      // flight right as the clock ran out.
      void handleFinish();
      return;
    }
    setAnswers((prev) => new Map(prev).set(currentQuestion.id, response));
  }

  function goToQuestion(index: number) {
    setCurrentIndex(index);
    setSubmitError(null);
    setDraftAnswer(answers.get(questions[index]?.id)?.selectedAnswer ?? "");
  }

  const answeredCount = useMemo(() => questions.filter((question) => answers.has(question.id)).length, [questions, answers]);

  if (questions.length === 0) {
    return (
      <Card className="items-center gap-2 p-10 text-center">
        <p className="font-medium">No active questions in this pack yet</p>
      </Card>
    );
  }

  if (result) {
    return <SessionSummary pack={pack} questions={questions} answers={answers} result={result} />;
  }

  if (!sessionId) {
    return (
      <Card className="items-center gap-3 p-10 text-center">
        <h1 className="font-heading text-xl font-semibold">{pack.name}</h1>
        {pack.description && <p className="max-w-md text-sm text-muted-foreground">{pack.description}</p>}
        <p className="text-sm text-muted-foreground">
          {questions.length} question{questions.length === 1 ? "" : "s"}
          {pack.timeLimitSeconds ? ` · ${formatDuration(pack.timeLimitSeconds)} time limit` : ""}
        </p>
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
            "Start practice"
          )}
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Question {currentIndex + 1} of {questions.length} · {answeredCount} answered
        </p>
        {secondsLeft !== null && (
          <span className={`flex items-center gap-1 text-sm font-medium ${secondsLeft <= 30 ? "text-destructive" : ""}`}>
            <Timer className="size-4" /> {formatDuration(Math.max(0, secondsLeft))}
          </span>
        )}
      </div>
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
