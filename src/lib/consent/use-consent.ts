"use client";

import { useCallback, useSyncExternalStore } from "react";
import { CONSENT_COOKIE_MAX_AGE_SECONDS, CONSENT_COOKIE_NAME, parseConsentCookie, serializeConsentCookie } from "@/lib/consent/cookie";
import { DEFAULT_CONSENT_STATE, type ConsentState } from "@/lib/consent/types";

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

// A plain module-level pub-sub, not React state — useSyncExternalStore
// is what actually avoids a hydration mismatch here, not a useEffect +
// setState dance: getServerSnapshot always returns `null` ("not yet
// known" — see ConsentState's own null-decidedAt-vs-null-state
// distinction), so the server-rendered markup never assumes a real
// choice, and the client's own snapshot is only ever read for the
// client's own render pass, never diffed against that server output.
const listeners = new Set<() => void>();
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function notify(): void {
  for (const listener of listeners) listener();
}

// Cached by the raw cookie string, not recomputed into a fresh object
// on every call — useSyncExternalStore compares snapshots by reference,
// so a getSnapshot that always returns a new object (even with
// identical contents) would look like a change on every render.
let cachedRaw: string | undefined;
let cachedState: ConsentState = DEFAULT_CONSENT_STATE;

function getSnapshot(): ConsentState {
  const raw = readCookie(CONSENT_COOKIE_NAME);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedState = parseConsentCookie(raw);
  }
  return cachedState;
}

function getServerSnapshot(): null {
  return null;
}

export function useConsent() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const save = useCallback((preferences: { analytics: boolean; marketing: boolean }): ConsentState => {
    const next: ConsentState = {
      necessary: true,
      analytics: preferences.analytics,
      marketing: preferences.marketing,
      decidedAt: new Date().toISOString(),
    };
    document.cookie = `${CONSENT_COOKIE_NAME}=${serializeConsentCookie(next)}; path=/; max-age=${CONSENT_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    notify();
    return next;
  }, []);

  return { state, save };
}
