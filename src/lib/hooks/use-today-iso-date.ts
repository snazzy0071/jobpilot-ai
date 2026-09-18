"use client";

import { useSyncExternalStore } from "react";

function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): string {
  return new Date().toISOString().slice(0, 10);
}

function getServerSnapshot(): undefined {
  return undefined;
}

/**
 * Today's date as `YYYY-MM-DD`, for a date input's `max` — `undefined`
 * on the server (and on the client's first render, before hydration),
 * never a real `new Date()` value computed independently by the server
 * and the client. Computing it eagerly at module/render scope instead
 * is a real hydration-mismatch trigger: server-render and client-
 * hydration happen at different wall-clock moments, and if those straddle
 * a UTC midnight rollover the two computed strings differ by a day.
 * `useSyncExternalStore`'s server-snapshot argument is the React-
 * sanctioned way to avoid that (same pattern as theme-toggle.tsx and
 * use-consent.ts in this codebase) — no subscription is needed since
 * nothing should re-render when the date changes mid-session.
 */
export function useTodayIsoDate(): string | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
