"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

type SaveResult = { error: string } | { success: string; id?: string } | void;

/**
 * Debounced autosave for a whole `<form>`: call `scheduleSave(formData)`
 * on every field change (a single form-level `onChange` handler building
 * `new FormData(formEl)` covers every field without per-input wiring —
 * React's onChange already fires on every keystroke for text inputs, and
 * bubbles up from any descendant field). After `delayMs` of inactivity
 * it calls the real Server Action directly (not through a submit event —
 * these forms have no Save button any more) and exposes the result as a
 * status for a visible Saved/Saving/Error indicator.
 *
 * `flush()` saves immediately, used when a row is about to close (an
 * "add"/"edit" panel collapsing) so a pending edit within the debounce
 * window isn't silently lost.
 */
export function useAutosave(
  save: (prevState: SaveResult, formData: FormData) => Promise<SaveResult>,
  options?: { delayMs?: number; onSaved?: (id: string | undefined) => void },
) {
  const { delayMs = 800, onSaved } = options ?? {};
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFormDataRef = useRef<FormData | null>(null);
  const inFlightRef = useRef<Promise<SaveResult> | null>(null);
  const saveRef = useRef(save);
  const onSavedRef = useRef(onSaved);

  // Refs are for reading in event handlers/effects, never written during
  // render (the rules-of-hooks `refs` check flags exactly that) — this
  // keeps them current with the latest props right after each render
  // instead.
  useEffect(() => {
    saveRef.current = save;
    onSavedRef.current = onSaved;
  });

  const runSave = useCallback(async (): Promise<SaveResult> => {
    let result: SaveResult = undefined;

    // A loop, not recursion: if a newer change arrives while a save is
    // still in flight, run it immediately after instead of waiting out a
    // fresh debounce window on top of the one that already elapsed.
    while (pendingFormDataRef.current) {
      const formData = pendingFormDataRef.current;
      pendingFormDataRef.current = null;

      setStatus("saving");
      // The Server Action call itself must happen inside startTransition
      // for its revalidatePath to actually refresh this route's data —
      // these calls bypass a <form action={...}> submission (which wraps
      // this automatically), so without it the save would succeed but
      // the rest of the page could keep showing stale server-fetched
      // data.
      const promise = new Promise<SaveResult>((resolve) => {
        startTransition(() => {
          saveRef.current(undefined, formData).then(resolve);
        });
      });
      inFlightRef.current = promise;
      result = await promise;
      inFlightRef.current = null;

      if (result && "error" in result) {
        setStatus("error");
        setErrorMessage(result.error);
        return result;
      }

      setStatus("saved");
      setErrorMessage(null);
      if (result && "success" in result) onSavedRef.current?.(result.id);
    }

    return result;
  }, []);

  const scheduleSave = useCallback(
    (formData: FormData) => {
      pendingFormDataRef.current = formData;
      setStatus("saving");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        void runSave();
      }, delayMs);
    },
    [delayMs, runSave],
  );

  const flush = useCallback(async (): Promise<SaveResult> => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingFormDataRef.current) return runSave();
    if (inFlightRef.current) return inFlightRef.current;
    return undefined;
  }, [runSave]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { status, errorMessage, scheduleSave, flush };
}
