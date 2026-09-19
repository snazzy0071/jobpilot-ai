"use client";

import { CheckIcon, FlameIcon } from "lucide-react";
import { MockWindow } from "@/components/marketing/mock-window";
import { useDemoStep } from "@/components/marketing/home/use-demo-step";
import { AnimatedBar } from "@/components/dashboard/animated-bar";
import { AnimatedNumber } from "@/components/marketing/home/animated-number";
import { cn } from "@/lib/utils";

const OPTIONS = ["Follows", "Does not follow", "Cannot say"];
const CORRECT = 0;
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Test-prep demo: answer a critical-thinking question, get instant
 * feedback, watch the day's streak and accuracy update. The question is
 * original, written for this mockup, in the generic
 * "does the conclusion follow" format, not taken from any test provider.
 */
export function TestPrepDemo() {
  const { ref, step } = useDemoStep(4, { interval: 1500, startDelay: 900, hold: 3200 });
  const picked = step >= 1;
  const revealed = step >= 2;
  const streakUpdated = step >= 3;
  const litDays = streakUpdated ? 4 : 3;
  const accuracy = streakUpdated ? 80 : 75;

  return (
    <div ref={ref}>
      <MockWindow title="Grad Scheme Prep · example">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              Critical Thinking
            </span>
            <div className="flex items-center gap-1" aria-label="Question 3 of 5">
              {[0, 1, 2, 3, 4].map((segment) => (
                <span
                  key={segment}
                  className={cn(
                    "h-1.5 w-5 rounded-full transition-colors duration-500",
                    segment < 2 || (segment === 2 && revealed) ? "bg-primary" : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Every volunteer who finishes the induction is added to the roster. Sam finished the induction.
            </p>
            <p className="text-sm font-medium">Conclusion: Sam was added to the roster.</p>
            <div className="flex flex-wrap gap-2">
              {OPTIONS.map((option, index) => {
                const isPicked = picked && index === CORRECT;
                const isRight = revealed && index === CORRECT;
                return (
                  <span
                    key={option}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-all duration-300",
                      !isPicked && "text-muted-foreground",
                      isPicked && !isRight && "border-primary bg-primary/10 text-primary",
                      isRight && "border-success bg-success/10 font-medium text-success",
                    )}
                  >
                    {isRight && <CheckIcon className="size-3" />}
                    {option}
                  </span>
                );
              })}
            </div>
            <p
              className={cn(
                "text-xs text-success transition-all duration-300",
                revealed ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
              )}
              aria-hidden={!revealed}
            >
              Correct. The rule applies to everyone who finished, and Sam did.
            </p>
          </div>

          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <FlameIcon className={cn("size-3.5 text-primary transition-transform duration-300", streakUpdated && "scale-125")} />
                {litDays}-day streak
              </p>
              <div className="flex gap-1.5">
                {DAYS.map((day, index) => (
                  <span
                    key={index}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[10px] font-medium transition-colors duration-500",
                      index < litDays ? "gradient-brand text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium">Accuracy</span>
                <span className="tabular-nums text-muted-foreground">
                  <AnimatedNumber value={accuracy} />%
                </span>
              </div>
              <AnimatedBar value={accuracy} />
            </div>
          </div>
        </div>
      </MockWindow>
    </div>
  );
}
