"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Storage can be blocked (private mode); the switch still works for this page view.
  }
}

/**
 * Light / dark switch. The saved choice is applied before paint by public/theme-init.js; this only reads it back
 * and flips it. Dark is the default.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Sync with the class theme-init.js already set before hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        const next: Theme = dark ? "light" : "dark";
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-surface/70 text-foreground/80 shadow-card backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <SunIcon
        aria-hidden="true"
        className={cn("absolute size-4 transition-all duration-500", dark ? "translate-y-6 rotate-90 opacity-0" : "translate-y-0 rotate-0 opacity-100")}
      />
      <MoonIcon
        aria-hidden="true"
        className={cn("absolute size-4 transition-all duration-500", dark ? "translate-y-0 rotate-0 opacity-100" : "-translate-y-6 -rotate-90 opacity-0")}
      />
    </button>
  );
}
