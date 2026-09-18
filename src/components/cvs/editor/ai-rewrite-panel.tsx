"use client";

import { useState } from "react";
import { SparklesIcon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resolveAtsRewrite, type AiRewriteResult } from "@/lib/cvs/ai-actions";

type Suggestion = { original: string; suggestion: string; explanation: string; rewriteId: string | null };

/**
 * Generic "rewrite this field with AI" flow, shared by the CV summary/
 * experience-description forms and (via a different `resolve`) the
 * cover letter paragraph editor: original vs. suggestion, an explanation
 * of what changed, and Accept / Try again / Reject. Nothing here writes
 * to the field until Accept — Try again re-requests a fresh suggestion
 * for the *same* original, Reject just discards it. `getValue` is read
 * fresh at request time (not a static prop) since these are uncontrolled
 * forms — the field may have been edited since the panel last opened.
 *
 * `resolve` defaults to `resolveAtsRewrite` (the CV callers' original,
 * only behavior before this prop existed) — best-effort either way, a
 * failed resolve shouldn't block Accept/Reject/Try again from
 * proceeding, it just leaves that suggestion's row unresolved.
 */
export function AiRewritePanel({
  getValue,
  rewrite,
  onAccept,
  resolve = (rewriteId, status) => resolveAtsRewrite({ rewriteId, status }),
  label = "Rewrite with AI",
}: {
  getValue: () => string;
  rewrite: (currentValue: string) => Promise<AiRewriteResult>;
  onAccept: (suggestion: string) => void;
  resolve?: (rewriteId: string, status: "accepted" | "rejected") => Promise<void>;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Suggestion | null>(null);

  function resolveInBackground(rewriteId: string | null, status: "accepted" | "rejected") {
    if (!rewriteId) return;
    void resolve(rewriteId, status).catch(() => {});
  }

  async function request(original: string) {
    setLoading(true);
    setError(null);
    const outcome = await rewrite(original);
    setLoading(false);
    if ("error" in outcome) {
      setError(outcome.error);
      return;
    }
    setResult({ original, suggestion: outcome.suggestion, explanation: outcome.explanation, rewriteId: outcome.rewriteId });
  }

  function handleStart() {
    const original = getValue().trim();
    if (!original) return;
    setResult(null);
    void request(original);
  }

  function handleTryAgain() {
    if (!result) return;
    // The suggestion being replaced was implicitly turned down.
    resolveInBackground(result.rewriteId, "rejected");
    void request(result.original);
  }

  function handleAccept() {
    if (!result) return;
    resolveInBackground(result.rewriteId, "accepted");
    onAccept(result.suggestion);
    setResult(null);
    setError(null);
  }

  function handleReject() {
    if (result) resolveInBackground(result.rewriteId, "rejected");
    setResult(null);
    setError(null);
  }

  if (!result && !loading && !error) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={handleStart} className="self-start">
        <SparklesIcon /> {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
      {loading && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" /> Thinking of a stronger version…
        </p>
      )}

      {!loading && error && (
        <>
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4" /> {error}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleStart}>
              Try again
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleReject}>
              Dismiss
            </Button>
          </div>
        </>
      )}

      {!loading && result && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1 rounded-md border bg-background p-2.5">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{result.original}</p>
            </div>
            <div className="flex-1 rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <p className="mb-1 text-xs font-medium text-primary">Suggestion</p>
              <p className="whitespace-pre-wrap text-sm">{result.suggestion}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Why: </span>
            {result.explanation}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleAccept}>
              Accept
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleTryAgain}>
              Try again
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleReject}>
              Reject
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
