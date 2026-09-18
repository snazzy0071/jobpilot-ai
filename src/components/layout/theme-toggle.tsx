"use client";

import { useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// The DOM class is the actual source of truth (set instantly, pre-hydration,
// by the inline script in the root layout) — useSyncExternalStore is the
// React-sanctioned way to read a mutable external value like this without
// a manual "sync state in an effect" dance, and its server-snapshot
// argument is exactly the mechanism for avoiding a hydration mismatch
// warning on a value the server can't know.
function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

/**
 * Dark/light toggle for the dashboard-area headers (docs/SCREENSHOT_MAP.md's
 * dashboard.png etc. all show one) — a real, working preference, persisted
 * to localStorage.
 */
export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing / storage disabled — theme still applies for this load.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </Button>
  );
}
