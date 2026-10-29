"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Sticky header wrapper: transparent over the hero, frosted white with a soft shadow once the page scrolls. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled
          ? "border-border/70 bg-white/80 shadow-[0_8px_30px_-12px_rgba(15,26,61,0.15)] backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-white/40 backdrop-blur-md",
      )}
    >
      {children}
    </header>
  );
}
