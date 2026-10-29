"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

// Fixed positions so server and client render the same markup.
const BUBBLES = [
  { left: "6%", size: 14, delay: "0s", duration: "17s", drift: "30px", color: "bg-primary/40" },
  { left: "14%", size: 8, delay: "-6s", duration: "13s", drift: "-20px", color: "bg-brand-cyan/50" },
  { left: "23%", size: 18, delay: "-11s", duration: "21s", drift: "40px", color: "bg-brand-coral/35" },
  { left: "34%", size: 10, delay: "-3s", duration: "15s", drift: "-30px", color: "bg-brand-sun/50" },
  { left: "45%", size: 6, delay: "-9s", duration: "12s", drift: "20px", color: "bg-primary/40" },
  { left: "55%", size: 16, delay: "-14s", duration: "19s", drift: "-40px", color: "bg-brand-cyan/45" },
  { left: "64%", size: 9, delay: "-2s", duration: "14s", drift: "25px", color: "bg-brand-pink/40" },
  { left: "73%", size: 20, delay: "-8s", duration: "23s", drift: "-25px", color: "bg-primary/30" },
  { left: "82%", size: 7, delay: "-12s", duration: "13s", drift: "30px", color: "bg-brand-sun/55" },
  { left: "91%", size: 12, delay: "-5s", duration: "18s", drift: "-35px", color: "bg-brand-coral/40" },
];

/**
 * Full-screen moving background for the sign-in and sign-up pages: morphing colour blobs, a fine grid, two slowly
 * spinning rings, bubbles drifting upward and a soft glow that follows the mouse. Decorative only (aria-hidden,
 * pointer-events none). Reduced-motion users get the same picture standing still.
 */
export function AuthBackdrop() {
  const glow = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    function move(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (glow.current) glow.current.style.transform = `translate3d(${event.clientX - 300}px, ${event.clientY - 300}px, 0)`;
      });
    }
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
    };
  }, [reduced]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="section-mesh absolute inset-0" />
      <div className="animate-blob absolute -top-40 -left-32 size-[34rem] bg-brand-cyan/45 blur-3xl" />
      <div className="animate-blob absolute -top-32 right-[-8rem] size-[38rem] bg-primary/35 blur-3xl [animation-delay:-6s]" />
      <div className="animate-blob absolute bottom-[-12rem] left-[20%] size-[30rem] bg-brand-sun/35 blur-3xl [animation-delay:-11s]" />
      <div className="animate-blob absolute right-[5%] bottom-[-10rem] size-[30rem] bg-brand-coral/30 blur-3xl [animation-delay:-3s]" />
      <div className="animate-blob absolute top-[35%] left-[45%] size-[20rem] bg-brand-pink/20 blur-3xl [animation-delay:-15s]" />
      <div className="bg-grid-light absolute inset-0 [mask-image:radial-gradient(ellipse_80%_80%_at_50%_40%,black,transparent_85%)]" />

      <div className="absolute top-1/2 left-[28%] -translate-x-1/2 -translate-y-1/2">
        <div className="animate-spin-slow size-[44rem] rounded-full border border-dashed border-primary/20" />
      </div>
      <div className="absolute top-1/2 left-[28%] -translate-x-1/2 -translate-y-1/2">
        <div className="animate-spin-slow size-[30rem] rounded-full border border-brand-cyan/25 [animation-direction:reverse]">
          <span className="absolute top-0 left-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-coral shadow-[0_0_16px_4px_rgba(255,106,61,0.5)]" />
        </div>
      </div>

      {BUBBLES.map((bubble) => (
        <span
          key={bubble.left}
          className={`animate-rise absolute -bottom-8 rounded-full blur-[1px] ${bubble.color}`}
          style={
            {
              left: bubble.left,
              width: bubble.size,
              height: bubble.size,
              animationDelay: bubble.delay,
              "--rise-duration": bubble.duration,
              "--drift": bubble.drift,
            } as React.CSSProperties
          }
        />
      ))}

      <div
        ref={glow}
        className="absolute top-0 left-0 size-[600px] rounded-full bg-radial from-primary/20 via-brand-cyan/10 to-transparent blur-2xl transition-transform duration-300 ease-out"
        style={{ transform: "translate3d(-600px, -600px, 0)" }}
      />
    </div>
  );
}
