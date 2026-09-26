import type { AdapterOutcome, ApplyAdapter, ApplyPackage } from "@/lib/auto-apply/adapters/types";
import type { QueueStatus } from "@/lib/auto-apply/types";

// One processing attempt for one approved queue item: run the adapter, then decide, from its outcome alone, what happens next.
// Pure apart from calling the adapter it is given (and the clock it is passed), so retries, back-off and the hand-off to the user
// are unit-tested with fake adapters. The database update and the audit event are done by the caller from this result.

export const RETRY_BASE_MINUTES = 15;
/** 15, 30, 60 ... minutes, capped at 6 hours: a temporary problem gets more room each time, not a hammering. */
export function retryDelayMinutes(attemptsSoFar: number): number {
  return Math.min(RETRY_BASE_MINUTES * 2 ** Math.max(0, attemptsSoFar - 1), 360);
}

export type AttemptResult = {
  status: QueueStatus;
  attemptCount: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  /** The audit event name for this result. */
  event: "submitted" | "handed_to_manual" | "blocked_handed_to_manual" | "attempt_failed" | "gave_up_handed_to_manual" | "failed";
  /** True when the application was really sent (so the tracker should log it as applied, without asking the user). */
  sent: boolean;
  reference: string | null;
};

const clip = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 300);

export async function runAttempt(item: { attemptCount: number; maxAttempts: number; hasApplyUrl: boolean }, adapter: ApplyAdapter, pkg: ApplyPackage, now: Date): Promise<AttemptResult> {
  const attemptCount = item.attemptCount + 1;
  let outcome: AdapterOutcome;
  try {
    outcome = await adapter.apply(pkg);
  } catch {
    // An adapter that throws is a temporary problem, not a reason to lose the application. (The message is not kept: it could contain anything.)
    outcome = { kind: "retryable_error", reason: "The adapter hit an unexpected error." };
  }

  switch (outcome.kind) {
    case "submitted":
      return { status: "applied", attemptCount, nextAttemptAt: null, lastError: null, event: "submitted", sent: true, reference: outcome.reference ? clip(outcome.reference) : null };
    case "manual_required":
      return { status: "needs_manual", attemptCount, nextAttemptAt: null, lastError: clip(outcome.reason), event: "handed_to_manual", sent: false, reference: null };
    case "blocked":
      // A protection was met: straight to the user, no retry, no workaround.
      return { status: "needs_manual", attemptCount, nextAttemptAt: null, lastError: clip(outcome.reason), event: "blocked_handed_to_manual", sent: false, reference: null };
    case "permanent_error":
      return item.hasApplyUrl
        ? { status: "needs_manual", attemptCount, nextAttemptAt: null, lastError: clip(outcome.reason), event: "handed_to_manual", sent: false, reference: null }
        : { status: "failed", attemptCount, nextAttemptAt: null, lastError: clip(outcome.reason), event: "failed", sent: false, reference: null };
    case "retryable_error":
    default: {
      if (attemptCount >= item.maxAttempts) {
        // Out of tries: the user can still apply by hand, so it isn't lost.
        return { status: "needs_manual", attemptCount, nextAttemptAt: null, lastError: clip(`Gave up after ${attemptCount} attempts: ${outcome.kind === "retryable_error" ? outcome.reason : ""}`), event: "gave_up_handed_to_manual", sent: false, reference: null };
      }
      return { status: "approved", attemptCount, nextAttemptAt: new Date(now.getTime() + retryDelayMinutes(attemptCount) * 60_000), lastError: outcome.kind === "retryable_error" ? clip(outcome.reason) : null, event: "attempt_failed", sent: false, reference: null };
    }
  }
}

/** Approved items whose retry time has arrived (or that were never tried), oldest approval first. */
export function dueItems<T extends { status: QueueStatus; nextAttemptAt: string | null; approvedAt: string | null }>(items: T[], now: Date): T[] {
  return items
    .filter((item) => item.status === "approved" && (!item.nextAttemptAt || new Date(item.nextAttemptAt) <= now))
    .sort((a, b) => (a.approvedAt ?? "").localeCompare(b.approvedAt ?? ""));
}
