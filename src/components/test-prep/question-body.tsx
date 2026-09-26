"use client";

import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ExhibitView, FigureCellView } from "@/components/test-prep/exhibit-view";
import type { Question } from "@/lib/test-prep/types";

/** What the options should show once an answer is revealed. Null while the question is still open (or in a timed attempt). */
export type Reveal = { correctAnswer: string | null; selectedAnswer: string | null } | null;

/**
 * One question, in one place: the passage or scenario, the table / chart / figure, the prompt, and the options as a real
 * radio group (arrow keys move between them, Space selects, a screen reader announces "1 of 4"). Diagrammatic answers are
 * pictures, each with a text description as its accessible name. Colour is never the only signal: the correct option gets
 * a tick and the wrong choice a cross.
 */
export function QuestionBody({
  question,
  index,
  total,
  value,
  onChange,
  disabled,
  reveal,
}: {
  question: Question;
  index: number;
  total: number;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  reveal: Reveal;
}) {
  const groupName = `question-${question.id}`;

  return (
    <div className="flex flex-col gap-4" data-testid="question-body">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Question {index + 1} of {total}
        </span>
        {question.difficulty && <Badge variant="outline">{question.difficulty}</Badge>}
        {question.subtype && <Badge variant="outline">{question.subtype}</Badge>}
      </div>

      {question.stimulus && (
        <blockquote className="rounded-lg border-l-4 border-primary/40 bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-line" data-testid="question-stimulus">
          {question.stimulus}
        </blockquote>
      )}

      {question.exhibit && <ExhibitView exhibit={question.exhibit} />}

      <p className="text-base leading-relaxed whitespace-pre-line" data-testid="question-prompt">
        {question.prompt}
      </p>

      {question.questionType === "free_text" ? (
        <Textarea rows={4} maxLength={500} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} placeholder="Type your answer…" aria-label="Your answer" />
      ) : (
        <div role="radiogroup" aria-label={`Answer to question ${index + 1}`} className={question.optionFigures ? "flex flex-wrap gap-3" : "flex flex-col gap-2"}>
          {question.options.map((option, optionIndex) => {
            const selected = value === option;
            const isCorrect = reveal !== null && reveal.correctAnswer === option;
            const isWrongChoice = reveal !== null && reveal.selectedAnswer === option && !isCorrect;
            const figure = question.optionFigures?.[optionIndex];
            const tone = isCorrect ? "border-primary bg-primary/10" : isWrongChoice ? "border-destructive bg-destructive/10" : selected ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40";

            return (
              <label
                key={option}
                className={`relative flex cursor-pointer gap-3 rounded-lg border p-3 text-left text-sm transition-colors focus-within:ring-3 focus-within:ring-ring/50 ${disabled ? "cursor-default" : ""} ${tone} ${figure ? "flex-col items-center" : "items-start"}`}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={option}
                  checked={selected}
                  disabled={disabled}
                  onChange={() => onChange(option)}
                  className="sr-only"
                  aria-label={figure ? `Option ${option}` : undefined}
                />
                {figure ? (
                  <>
                    <FigureCellView cell={figure} className="size-20 sm:size-24" />
                    <span className="flex items-center gap-1 font-medium">
                      {isCorrect && <CheckCircle2Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />}
                      {isWrongChoice && <XCircleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />}
                      {option}
                      {isCorrect && <span className="sr-only"> (correct answer)</span>}
                      {isWrongChoice && <span className="sr-only"> (your answer, incorrect)</span>}
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${selected || isCorrect ? "border-primary" : "border-input"}`}
                    >
                      {(selected || isCorrect) && <span className={`size-2 rounded-full ${isWrongChoice ? "bg-destructive" : "bg-primary"}`} />}
                    </span>
                    <span className="flex-1">{option}</span>
                    {isCorrect && (
                      <>
                        <CheckCircle2Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="sr-only">(correct answer)</span>
                      </>
                    )}
                    {isWrongChoice && (
                      <>
                        <XCircleIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                        <span className="sr-only">(your answer, incorrect)</span>
                      </>
                    )}
                  </>
                )}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
