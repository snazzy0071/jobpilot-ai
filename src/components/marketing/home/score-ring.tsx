"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/marketing/home/animated-number";
import { cn } from "@/lib/utils";

/**
 * A circular score gauge. The arc draws in once when scrolled into view
 * and eases to any later `value` change. Sizes with its container's
 * `size` (px) so the same component serves the hero chip, the ATS demo
 * and the job cards.
 */
export function ScoreRing({
  value,
  size = 72,
  stroke = 6,
  suffix,
  className,
  tone = "primary",
}: {
  value: number;
  size?: number;
  stroke?: number;
  suffix?: string;
  className?: string;
  tone?: "primary" | "success" | "warning";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reducedMotion = useReducedMotion();
  const radius = (size - stroke) / 2;
  const target = Math.max(0, Math.min(100, value)) / 100;

  const color = tone === "success" ? "var(--success)" : tone === "warning" ? "var(--warning)" : "var(--primary)";

  return (
    <div
      ref={ref}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${value} out of 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: reducedMotion ? target : 0 }}
          animate={{ pathLength: inView ? target : reducedMotion ? target : 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.9, ease: "easeOut" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
        style={{ fontSize: Math.round(size * 0.3) }}
        aria-hidden="true"
      >
        {inView || reducedMotion ? <AnimatedNumber value={value} /> : 0}
        {suffix && <span className="ml-px text-[0.55em] font-normal text-muted-foreground">{suffix}</span>}
      </span>
    </div>
  );
}
