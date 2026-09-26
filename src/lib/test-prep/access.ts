import "server-only";
import { EntitlementError, hasFeature, requireFeature } from "@/lib/entitlements/service";

// Test Prep is the "Grad Scheme Prep" tool: the `grad_scheme_prep` plan feature (Premium and Elite — see /pricing and
// src/config/tools.ts). EVERY server entry point into practice — starting a session, submitting an answer, finishing,
// reviewing, the daily five, focused practice, progress — checks it here before doing anything. Hiding the page in the UI
// is only ever a courtesy on top of this.

export const TEST_PREP_FEATURE = "grad_scheme_prep" as const;

export const TEST_PREP_LOCKED_MESSAGE = "Test Prep is part of the Premium and Elite plans. Upgrade to unlock practice, timed mode, the daily five and your progress.";

export async function hasTestPrepAccess(userId: string): Promise<boolean> {
  return hasFeature(userId, TEST_PREP_FEATURE);
}

/** Throws EntitlementError when the plan doesn't include Test Prep. */
export async function requireTestPrepAccess(userId: string): Promise<void> {
  try {
    await requireFeature(userId, TEST_PREP_FEATURE);
  } catch (err) {
    if (err instanceof EntitlementError) throw new EntitlementError(TEST_PREP_LOCKED_MESSAGE);
    throw err;
  }
}

/** For Server Actions: turns the entitlement failure into a result the UI can show, and re-throws anything else. */
export async function gateTestPrep(userId: string): Promise<{ error: string; locked: true } | null> {
  try {
    await requireTestPrepAccess(userId);
    return null;
  } catch (err) {
    if (err instanceof EntitlementError) return { error: err.message, locked: true };
    throw err;
  }
}
