"use client";

import { useEffect } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

/** A number that eases to each new `value` (no per-frame React state: the DOM text is driven by a motion value). */
export function AnimatedNumber({ value, duration = 0.8 }: { value: number; duration?: number }) {
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));

  useEffect(() => {
    if (reducedMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [value, duration, reducedMotion, motionValue]);

  return <motion.span>{rounded}</motion.span>;
}
