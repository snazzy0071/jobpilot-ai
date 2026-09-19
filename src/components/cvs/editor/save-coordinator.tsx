"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { callAction } from "@/components/cvs/editor/call-action";
import { deriveOverallStatus, type SaveStatus, type SourceState } from "@/lib/cvs/save-status";

type ActionResult = { error: string } | { success: string; id?: string } | void;
type Flusher = () => Promise<ActionResult>;

type SaveCoordinator = {
  /** One status for the whole editor: every autosaving form, the template save, reorders... */
  overall: SourceState;
  /** A save source reports its own status here (the autosave hook does this for every form). */
  report: (key: string, status: SaveStatus, message?: string | null) => void;
  /** A save source registers how to flush its pending work, so export/navigation can wait for it. */
  register: (key: string, flush: Flusher) => () => void;
  /** Saves everything that's pending and resolves with the first error, or null when it is all persisted. */
  flushAll: () => Promise<{ error: string } | null>;
  /** Runs a one-off Server Action (a reorder, say) with its status and any error reported, never dropped. */
  track: <T extends ActionResult>(key: string, run: () => Promise<T>) => Promise<T | { error: string }>;
};

const CoordinatorContext = createContext<SaveCoordinator | null>(null);

/**
 * The single place the editor's save state lives. Before this, each form's
 * autosave hook kept its status to itself: nothing could tell whether the
 * CV as a whole was saved, so the header claimed "All changes saved"
 * unconditionally and PDF export could run while edits were still
 * unsaved. Now every source reports here, the header shows the real
 * overall state, and export/unload wait for (or warn about) pending work.
 */
export function CvSaveProvider({ children }: { children: ReactNode }) {
  const [sources, setSources] = useState<ReadonlyMap<string, SourceState>>(() => new Map());
  const flushers = useRef(new Map<string, Flusher>());
  const inFlight = useRef(new Set<Promise<unknown>>());

  const report = useCallback((key: string, status: SaveStatus, message: string | null = null) => {
    setSources((current) => {
      const existing = current.get(key);
      if (existing?.status === status && existing.message === message) return current;
      const next = new Map(current);
      if (status === "idle") next.delete(key);
      else next.set(key, { status, message });
      return next;
    });
  }, []);

  const register = useCallback((key: string, flush: Flusher) => {
    flushers.current.set(key, flush);
    return () => {
      if (flushers.current.get(key) === flush) flushers.current.delete(key);
    };
  }, []);

  const flushAll = useCallback(async (): Promise<{ error: string } | null> => {
    const results = await Promise.all([
      ...[...flushers.current.values()].map((flush) => flush().catch((error): ActionResult => ({ error: error instanceof Error ? error.message : "Couldn't save your changes." }))),
      ...[...inFlight.current].map((promise) => promise.catch(() => undefined) as Promise<ActionResult>),
    ]);
    for (const result of results) {
      if (result && typeof result === "object" && "error" in result) return { error: result.error };
    }
    return null;
  }, []);

  const track = useCallback(
    async <T extends ActionResult>(key: string, run: () => Promise<T>): Promise<T | { error: string }> => {
      report(key, "saving");
      const promise = callAction(run);
      inFlight.current.add(promise);
      try {
        const result = await promise;
        if (result && typeof result === "object" && "error" in result) {
          report(key, "error", result.error);
        } else {
          report(key, "saved");
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Couldn't save your changes.";
        report(key, "error", message);
        return { error: message };
      } finally {
        inFlight.current.delete(promise);
      }
    },
    [report],
  );

  const overall = useMemo(() => deriveOverallStatus(sources.values()), [sources]);

  // Closing the tab while a save is still in flight would lose the edit silently — ask first.
  const overallRef = useRef(overall);
  useEffect(() => {
    overallRef.current = overall;
  });
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (overallRef.current.status === "saving") event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const value = useMemo<SaveCoordinator>(() => ({ overall, report, register, flushAll, track }), [overall, report, register, flushAll, track]);
  return <CoordinatorContext.Provider value={value}>{children}</CoordinatorContext.Provider>;
}

/** For hooks that also work outside the editor (no provider → they just don't report). */
export function useOptionalCvSaves(): SaveCoordinator | null {
  return useContext(CoordinatorContext);
}

export function useCvSaves(): SaveCoordinator {
  const ctx = useContext(CoordinatorContext);
  if (!ctx) throw new Error("useCvSaves must be used within a CvPreviewProvider");
  return ctx;
}
