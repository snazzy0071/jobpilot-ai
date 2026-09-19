"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { MockWindow } from "@/components/marketing/mock-window";
import { Line } from "@/components/marketing/wireframe-line";
import { useDemoStep } from "@/components/marketing/home/use-demo-step";
import { cn } from "@/lib/utils";

const WEAK = "Responsible for handling customer queries and other duties as required.";
const STRONG = "Resolved 40+ customer queries a day, cutting response time by a third.";

const CHECKS = [
  { label: "A4, two pages", from: 2 },
  { label: "No photo, UK format", from: 3 },
  { label: "ATS pre-check passed", from: 4 },
];

/**
 * CV Builder demo, in five beats: a weak summary line, the AI rewrite,
 * then the three UK-format checks tick over in turn: the same
 * sequence the real editor runs (rewrite suggestion, page/margin
 * checks, ATS pre-flight). Illustrative content, labelled as such.
 */
export function CvBuilderDemo() {
  const { ref, step } = useDemoStep(5, { interval: 1500, hold: 3200 });
  const rewritten = step >= 1;

  return (
    <div ref={ref}>
      <MockWindow title="CV Builder · example">
        <div className="grid gap-5 sm:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col gap-4 rounded-xl border bg-background p-4">
            <div className="flex flex-col gap-1 border-b pb-3">
              <p className="text-sm font-semibold">Alex Morgan</p>
              <p className="text-xs text-muted-foreground">Software Engineer · London, UK</p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium tracking-wide text-primary uppercase">Summary</p>
                <AnimatePresence>
                  {rewritten && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      <SparklesIcon className="size-2.5" />
                      AI-tightened
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <div className="min-h-[3.25rem]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={rewritten ? "after" : "before"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn("text-xs leading-relaxed", rewritten ? "text-foreground" : "text-muted-foreground")}
                  >
                    {rewritten ? STRONG : WEAK}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium tracking-wide text-primary uppercase">Experience</p>
              <Line width="1/2" />
              <Line width="full" />
              <Line width="3/4" />
            </div>
          </div>

          <ul className="flex flex-col justify-center gap-2.5" aria-label="UK format checks">
            {CHECKS.map((check) => {
              const done = step >= check.from;
              return (
                <li
                  key={check.label}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors duration-300",
                    done ? "border-success/40 bg-success/5" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                      done ? "scale-100 bg-success text-white" : "scale-90 bg-muted text-transparent",
                    )}
                  >
                    <CheckIcon className="size-3.5" />
                  </span>
                  {check.label}
                </li>
              );
            })}
          </ul>
        </div>
      </MockWindow>
    </div>
  );
}
