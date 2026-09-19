"use client";

import { startTransition, useCallback, useEffect, useId, useRef, useState } from "react";
import { useOptionalCvSaves } from "@/components/cvs/editor/save-coordinator";
import { carryRowId, type SaveStatus } from "@/lib/cvs/save-status";

export type AutosaveStatus = SaveStatus;

type SaveResult = { error: string } | { success: string; id?: string } | void;

const UNREACHABLE_MESSAGE = "Couldn't reach the server, so this change isn't saved yet. Check your connection and try again.";

/**
 * Debounced autosave for a whole `<form>`: call `scheduleSave(formData)`
 * on every field change (a single form-level `onChange` handler building
 * `new FormData(formEl)` covers every field without per-input wiring).
 * After `delayMs` of inactivity it calls the real Server Action directly
 * and exposes the result as a status for a visible Saving / Saved / Error
 * indicator. Every state change is also reported to the editor's
 * CvSaveProvider, so the header shows one overall status and PDF export
 * can wait for pending saves.
 *
 * What this guarantees (each was a real way for an edit to be lost or
 * mis-shown):
 * - A Server Action that rejects (network drop, expired session, 500) is
 *   an error the user sees. It used to leave the status on "Saving…"
 *   forever and the edit unsaved.
 * - A failed snapshot is kept, and `flush()` retries it, so export or
 *   closing a row after a transient failure still saves the edit.
 * - An edit typed while a brand-new row's first save is still in flight
 *   is sent as an update of that row (the row's id is carried over), not
 *   as a second insert — no duplicate rows.
 * - Leaving the page inside the debounce window saves the pending edit
 *   instead of dropping it.
 * - One save loop at a time: edits made during a save are sent right
 *   after it, in order, never concurrently.
 */
export function useAutosave(
  save: (prevState: SaveResult, formData: FormData) => Promise<SaveResult>,
  options?: { delayMs?: number; onSaved?: (id: string | undefined) => void },
) {
  const { delayMs = 800, onSaved } = options ?? {};
  const coordinator = useOptionalCvSaves();
  const report = coordinator?.report;
  const register = coordinator?.register;
  const key = useId();

  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFormDataRef = useRef<FormData | null>(null);
  const failedFormDataRef = useRef<FormData | null>(null);
  const runningRef = useRef<Promise<SaveResult> | null>(null);
  const savedIdRef = useRef<string | null>(null);
  const saveRef = useRef(save);
  const onSavedRef = useRef(onSaved);

  // Refs are for reading in event handlers/effects, never written during render.
  useEffect(() => {
    saveRef.current = save;
    onSavedRef.current = onSaved;
  });

  // Reports to both this hook's own state and the editor-wide coordinator directly (not via an effect),
  // so a save that finishes after the form has unmounted still reaches the header.
  const update = useCallback(
    (next: AutosaveStatus, message: string | null = null) => {
      setStatus(next);
      setErrorMessage(message);
      report?.(key, next, message);
    },
    [report, key],
  );

  const loop = useCallback(async (): Promise<SaveResult> => {
    let result: SaveResult = undefined;

    while (pendingFormDataRef.current) {
      const formData = carryRowId(pendingFormDataRef.current, savedIdRef.current);
      pendingFormDataRef.current = null;
      failedFormDataRef.current = null;

      update("saving");
      // The Server Action call itself must happen inside startTransition for its revalidatePath to refresh
      // this route's data — these calls bypass a <form action>, which would wrap it automatically.
      result = await new Promise<SaveResult>((resolve) => {
        startTransition(() => {
          saveRef.current(undefined, formData).then(resolve, () => resolve({ error: UNREACHABLE_MESSAGE }));
        });
      });

      if (result && "error" in result) {
        failedFormDataRef.current = formData;
        // A newer snapshot typed during the failed save supersedes it: try that one next.
        if (pendingFormDataRef.current) continue;
        update("error", result.error);
        return result;
      }

      if (result && "success" in result) {
        if (result.id) savedIdRef.current = result.id;
        onSavedRef.current?.(result.id);
      }
      if (!pendingFormDataRef.current) update("saved");
    }

    return result;
  }, [update]);

  const runSave = useCallback((): Promise<SaveResult> => {
    if (runningRef.current) return runningRef.current;
    const promise = loop().finally(() => {
      runningRef.current = null;
    });
    runningRef.current = promise;
    return promise;
  }, [loop]);

  const scheduleSave = useCallback(
    (formData: FormData) => {
      pendingFormDataRef.current = formData;
      update("saving");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        void runSave();
      }, delayMs);
    },
    [delayMs, runSave, update],
  );

  /** Saves anything pending right now (or retries a snapshot that failed) and resolves once it is persisted. */
  const flush = useCallback(async (): Promise<SaveResult> => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (!pendingFormDataRef.current && failedFormDataRef.current) {
      pendingFormDataRef.current = failedFormDataRef.current;
      failedFormDataRef.current = null;
    }
    if (pendingFormDataRef.current) return runSave();
    if (runningRef.current) return runningRef.current;
    return undefined;
  }, [runSave]);

  useEffect(() => register?.(key, flush), [register, key, flush]);

  // Leaving the page (or closing the row's form) inside the debounce window must not drop the edit.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pendingFormDataRef.current || failedFormDataRef.current) {
        if (!pendingFormDataRef.current) pendingFormDataRef.current = failedFormDataRef.current;
        void runSave();
      } else if (!runningRef.current) {
        report?.(key, "idle");
      }
    };
  }, [runSave, report, key]);

  return { status, errorMessage, scheduleSave, flush };
}
