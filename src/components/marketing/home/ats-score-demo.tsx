"use client";

import { LayoutGroup, motion } from "framer-motion";
import { CheckIcon, PlusIcon } from "lucide-react";
import { MockWindow } from "@/components/marketing/mock-window";
import { ScoreRing } from "@/components/marketing/home/score-ring";
import { useDemoStep } from "@/components/marketing/home/use-demo-step";

const KEYWORDS = ["Leadership", "Excel", "SQL", "Data analysis", "Stakeholder management"];
// How many keywords are matched at each step; the rest are "missing".
const MATCHED_AT_STEP = [2, 3, 4, 5];
const SCORE_AT_STEP = [58, 67, 76, 88];

const chipBase = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium";

/**
 * ATS demo: the score starts low with three keywords missing from the CV;
 * each one is "added" in turn, sliding from the missing group to the
 * matched group while the ring climbs: the keyword-gap loop the real
 * scanner is built around. Numbers are illustrative.
 */
export function AtsScoreDemo() {
  const { ref, step } = useDemoStep(4, { interval: 1700, hold: 3200 });
  const matchedCount = MATCHED_AT_STEP[step];
  const matched = KEYWORDS.slice(0, matchedCount);
  const missing = KEYWORDS.slice(matchedCount);
  const score = SCORE_AT_STEP[step];

  return (
    <div ref={ref}>
      <MockWindow title="ATS scan · example">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <ScoreRing value={score} size={84} stroke={7} suffix="/100" />
            <div>
              <p className="text-sm font-semibold">Your CV match</p>
              <p className="text-xs text-muted-foreground">Against the job description you pasted</p>
            </div>
          </div>

          <LayoutGroup>
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium tracking-wide text-success uppercase">Matched</p>
              <div className="flex min-h-[2rem] flex-wrap gap-2">
                {matched.map((word) => (
                  <motion.span
                    key={word}
                    layout
                    layoutId={`kw-${word}`}
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                    className={`${chipBase} border-success/30 bg-success/10 text-success`}
                  >
                    <CheckIcon className="size-3" />
                    {word}
                  </motion.span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium tracking-wide text-warning uppercase">Missing</p>
              <div className="flex min-h-[2rem] flex-wrap gap-2">
                {missing.map((word) => (
                  <motion.span
                    key={word}
                    layout
                    layoutId={`kw-${word}`}
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                    className={`${chipBase} border-dashed border-warning/50 bg-warning/10 text-warning`}
                  >
                    <PlusIcon className="size-3" />
                    {word}
                  </motion.span>
                ))}
                {missing.length === 0 && <span className="text-xs text-muted-foreground">Nothing missing</span>}
              </div>
            </div>
          </LayoutGroup>
        </div>
      </MockWindow>
    </div>
  );
}
