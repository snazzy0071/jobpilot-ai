"use client";

import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Wraps a product mockup so it reacts to the pointer: a gentle 3D tilt (max ~5deg) and a soft glow that follows the cursor.
 * Pointer-only decoration: touch devices and anyone who prefers reduced motion get the plain, static mockup, and the content
 * inside is never altered or hidden. All motion is a CSS transform written straight to the element (no React state per move).
 */
export function ProductFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== "mouse" || !frame.current) return;
    const rect = frame.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    frame.current.style.transform = `perspective(1100px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg)`;
    frame.current.style.setProperty("--glow-x", `${((x + 0.5) * 100).toFixed(1)}%`);
    frame.current.style.setProperty("--glow-y", `${((y + 0.5) * 100).toFixed(1)}%`);
  }

  function reset() {
    if (frame.current) frame.current.style.transform = "";
  }

  return (
    <div
      ref={frame}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      className={cn("group/frame relative transition-transform duration-300 ease-out will-change-transform", className)}
    >
      <div
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] opacity-70 blur-2xl transition-opacity duration-300 group-hover/frame:opacity-100"
        style={{ background: "radial-gradient(circle at var(--glow-x, 50%) var(--glow-y, 40%), color-mix(in oklch, var(--primary), transparent 72%), transparent 62%)" }}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
