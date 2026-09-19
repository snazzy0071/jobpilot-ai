"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Line } from "@/components/marketing/wireframe-line";

const WEAK_SUMMARY = "Responsible for handling customer queries and other duties as required.";
const TIGHT_SUMMARY = "Resolved 40+ customer queries a day, cutting response time by a third.";

/**
 * An illustrative CV layout — a mockup for marketing, not a real
 * screenshot. `animated`, once this scrolls into view, crossfades the
 * summary line from a generic draft into an AI-tightened rewrite —
 * the same before/after this app's real CV editor does, just staged
 * as a one-shot demo rather than looping (a looping "AI is always
 * working" animation reads as a gimmick, not a real feature).
 */
export function CvPreview({ animated = false }: { animated?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -80px 0px" });
  const reducedMotion = useReducedMotion();
  const [tightened, setTightened] = useState(!animated || Boolean(reducedMotion));

  useEffect(() => {
    if (!animated || reducedMotion || !inView) return;
    const timer = setTimeout(() => setTightened(true), 1400);
    return () => clearTimeout(timer);
  }, [animated, reducedMotion, inView]);

  return (
    <div ref={ref}>
      <Card className="mx-auto w-full max-w-sm gap-4 p-6">
        <div className="flex flex-col gap-1 border-b pb-4">
          <p className="text-base font-semibold">Alex Morgan</p>
          <p className="text-sm text-muted-foreground">Software Engineer &middot; London, UK</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Summary</p>
            {animated && (
              <AnimatePresence>
                {tightened && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    AI-tightened
                  </motion.span>
                )}
              </AnimatePresence>
            )}
          </div>
          {animated ? (
            <AnimatePresence mode="wait">
              <motion.p
                key={tightened ? "after" : "before"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="text-xs leading-relaxed text-muted-foreground"
              >
                {tightened ? TIGHT_SUMMARY : WEAK_SUMMARY}
              </motion.p>
            </AnimatePresence>
          ) : (
            <>
              <Line width="full" />
              <Line width="3/4" />
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Experience</p>
          <Line width="1/2" />
          <Line width="full" />
          <Line width="full" />
          <Line width="1/3" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Skills</p>
          <Line width="3/4" />
        </div>
      </Card>
    </div>
  );
}
