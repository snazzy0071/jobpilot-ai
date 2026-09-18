import type { JobMatchVerdict } from "@/lib/jobs/types";

/**
 * Verdict is derived from `matchScore` by fixed thresholds here, rather
 * than asked of the AI directly (src/lib/ai/prompts/job-match.ts's
 * jobMatchSchema no longer has a `verdict` field as of v2.0.0) — a
 * deliberate transparency choice: a fixed, documented rule means the
 * label shown next to a score can never contradict the score itself
 * (the AI separately picking both risked "worth_applying" next to a
 * 55, or "strong_match" next to a 78). These specific cut points aren't
 * derived from anything external; they're this app's own reading of
 * the original prompt's own qualitative definitions (kept in the
 * comment below for traceability) and are a plain constant, easy to
 * retune without touching the scoring logic itself.
 *
 * strong_match:   close alignment — matchScore >= 80
 * worth_applying: a reasonable application with some gaps — >= 60
 * stretch:        above current evidenced experience, not impossible — >= 35
 * not_a_fit:      a fundamental mismatch — below 35
 */
export const VERDICT_THRESHOLDS = {
  strongMatch: 80,
  worthApplying: 60,
  stretch: 35,
} as const;

export function deriveVerdict(matchScore: number): JobMatchVerdict {
  if (matchScore >= VERDICT_THRESHOLDS.strongMatch) return "strong_match";
  if (matchScore >= VERDICT_THRESHOLDS.worthApplying) return "worth_applying";
  if (matchScore >= VERDICT_THRESHOLDS.stretch) return "stretch";
  return "not_a_fit";
}
