"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * Drives a demo as a short scripted sequence of steps (0..count-1).
 *
 * Built for the homepage's product demos: the timer only runs while the
 * demo is on screen (it pauses off-screen and resumes when scrolled
 * back), so nothing animates, and nothing schedules work, below the
 * fold until it is seen. With `prefers-reduced-motion` the demo simply
 * shows its final step and never advances.
 */
export function useDemoStep(
  count: number,
  {
    interval = 1400,
    startDelay = 500,
    hold = 2600,
    loop = true,
  }: { interval?: number; startDelay?: number; hold?: number; loop?: boolean } = {},
) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "0px 0px -12% 0px" });
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reducedMotion || !inView) return;
    const atEnd = step >= count - 1;
    if (atEnd && !loop) return;

    const wait = atEnd ? hold : step === 0 ? startDelay : interval;
    const timer = setTimeout(() => setStep(atEnd ? 0 : step + 1), wait);
    return () => clearTimeout(timer);
  }, [step, inView, reducedMotion, count, interval, startDelay, hold, loop]);

  return { ref, step: reducedMotion ? count - 1 : step, inView };
}
