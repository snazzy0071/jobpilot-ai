import "server-only";
import { EntitlementError, hasFeature, requireFeature } from "@/lib/entitlements/service";

// Auto-Apply is the `auto_apply` plan feature (Premium and Elite; migration 0118). EVERY server entry point checks it before doing
// anything — hiding the page is only ever a courtesy on top of this.

export const AUTO_APPLY_LOCKED_MESSAGE = "Assisted Auto-Apply is part of the Premium and Elite plans.";

export async function hasAutoApplyAccess(userId: string): Promise<boolean> {
  return hasFeature(userId, "auto_apply");
}

/** For Server Actions: turns the entitlement failure into a result the UI can show, and re-throws anything else. */
export async function gateAutoApply(userId: string): Promise<{ error: string; locked: true } | null> {
  try {
    await requireFeature(userId, "auto_apply");
    return null;
  } catch (err) {
    if (err instanceof EntitlementError) return { error: AUTO_APPLY_LOCKED_MESSAGE, locked: true };
    throw err;
  }
}
