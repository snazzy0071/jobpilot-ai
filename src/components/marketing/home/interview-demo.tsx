"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, LightbulbIcon, MessageSquareIcon, MinusIcon } from "lucide-react";
import { MockWindow } from "@/components/marketing/mock-window";
import { useDemoStep } from "@/components/marketing/home/use-demo-step";
import { AnimatedBar } from "@/components/dashboard/animated-bar";
import { cn } from "@/lib/utils";

// Each STAR part lights up as the answer "covers" it; Result is the one
// that's missing, so the demo shows the coach finding a real gap.
const STAR = [
  { key: "S", label: "Situation", covered: true },
  { key: "T", label: "Task", covered: true },
  { key: "A", label: "Action", covered: true },
  { key: "R", label: "Result", covered: false },
];

const SCORES = [
  { label: "Structure", value: 78 },
  { label: "Relevance", value: 88 },
  { label: "Clarity", value: 72 },
];

/**
 * Interview-coach demo: a competency question, then the four STAR parts
 * check off as they're found in the answer; the missing Result gets a
 * concrete tip and the score bars fill. STAR-structured feedback is
 * what the real coach returns. Illustrative content.
 */
export function InterviewDemo() {
  const { ref, step } = useDemoStep(6, { interval: 1300, startDelay: 700, hold: 3400 });
  const litUpTo = Math.min(step, 4); // 0..4 STAR parts revealed
  const showTip = step >= 4;
  const showScores = step >= 5;

  return (
    <div ref={ref}>
      <MockWindow title="Interview Coach · example">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageSquareIcon className="size-4" />
            </span>
            <p className="rounded-2xl rounded-tl-sm bg-muted/60 px-3.5 py-2.5 text-sm">
              Tell me about a time you led a project under pressure.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="STAR structure check">
            {STAR.map((part, index) => {
              const revealed = index < litUpTo;
              return (
                <li
                  key={part.key}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 text-xs transition-all duration-300",
                    !revealed && "text-muted-foreground opacity-60",
                    revealed && part.covered && "border-success/40 bg-success/5",
                    revealed && !part.covered && "border-dashed border-warning/60 bg-warning/10",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-300",
                      !revealed && "bg-muted",
                      revealed && part.covered && "bg-success text-white",
                      revealed && !part.covered && "bg-warning text-white",
                    )}
                  >
                    {revealed ? part.covered ? <CheckIcon className="size-3" /> : <MinusIcon className="size-3" /> : part.key}
                  </span>
                  {part.label}
                </li>
              );
            })}
          </ul>

          <div className="min-h-[2.75rem]">
            <AnimatePresence>
              {showTip && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs"
                >
                  <LightbulbIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <p>
                    <span className="font-medium">Add a result. </span>
                    <span className="text-muted-foreground">Say what changed, with a number if you have one.</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex flex-col gap-2.5">
            {SCORES.map((score, index) => (
              <div key={score.label} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{score.label}</span>
                  <span className="font-medium tabular-nums">{showScores ? `${score.value}%` : "–"}</span>
                </div>
                <AnimatedBar value={showScores ? score.value : 0} delay={index * 0.1} />
              </div>
            ))}
          </div>
        </div>
      </MockWindow>
    </div>
  );
}
