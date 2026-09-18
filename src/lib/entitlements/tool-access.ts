import "server-only";
import { hasFeature, checkUsageAllowed } from "@/lib/entitlements/service";
import type { FeatureKey, MeteredKey } from "@/lib/entitlements/types";
import { TOOLS } from "@/config/tools";

// The real, per-tool entitlement mapping — the "cover all paid tools"
// part of this task. Deliberately not derived from TOOLS[].plan (a
// single minimum-tier guess set when each tool's marketing page was
// built) — that field has already drifted from the real `plans` table
// for at least two tools (Job Match and Cover Letter Generator; see the
// Billing section of BUILD_CHECKLIST.md), and duplicating a second,
// UI-only notion of "which plan unlocks this" would only add a third
// place for the two to disagree. Every check here reads the actual
// configured entitlement instead.
type ToolAccessCheck =
  | { kind: "feature"; key: FeatureKey; label: string }
  | { kind: "metered"; key: MeteredKey; label: string };

const TOOL_ENTITLEMENT_CHECKS: Record<string, ToolAccessCheck[]> = {
  cv: [{ kind: "metered", key: "cv_limit", label: "CVs" }],
  ats: [
    { kind: "metered", key: "quick_ats_scans_per_month", label: "Quick ATS scans" },
    { kind: "metered", key: "tailored_ats_scans_per_month", label: "Tailored ATS scans" },
  ],
  "cover-letter": [{ kind: "feature", key: "cover_letter_generator", label: "Cover Letter Generator" }],
  interview: [
    { kind: "metered", key: "chat_interviews_per_month", label: "Chat interviews" },
    { kind: "metered", key: "voice_interviews_per_month", label: "Voice interviews" },
  ],
  tracker: [{ kind: "feature", key: "job_tracker", label: "Job Tracker" }],
  linkedin: [{ kind: "feature", key: "linkedin_optimiser", label: "LinkedIn Optimiser" }],
  jobmatch: [{ kind: "feature", key: "job_match", label: "Job Match" }],
  gradprep: [{ kind: "feature", key: "grad_scheme_prep", label: "Grad Scheme Prep" }],
};

export type AccessStatus = "available" | "locked" | "limit-reached";

export type CheckResult = {
  label: string;
  status: AccessStatus;
  used?: number;
  limit?: number | null;
  remaining?: number | null;
};

export type ToolAccessState = {
  toolSlug: string;
  status: AccessStatus;
  checks: CheckResult[];
};

async function resolveCheck(userId: string, check: ToolAccessCheck): Promise<CheckResult> {
  if (check.kind === "feature") {
    const has = await hasFeature(userId, check.key);
    return { label: check.label, status: has ? "available" : "locked" };
  }

  // Read-only peek, not consumeUsage — this is a display-only status
  // check, never followed by doing the gated work, so there's nothing
  // here for the check-then-act race (migration 0020) to apply to.
  // Anything that actually performs a metered action must call
  // requireUsageAllowed/consumeUsage itself, not read this state first.
  const usage = await checkUsageAllowed(userId, check.key);
  const status: AccessStatus = usage.limit === 0 ? "locked" : usage.allowed ? "available" : "limit-reached";
  return { label: check.label, status, used: usage.used, limit: usage.limit, remaining: usage.remaining };
}

/**
 * Resolves the real access state for one tool from the user's actual
 * entitlements — the thing any future tool page or API route should
 * render its locked/limited/available UI from, not a value passed down
 * from a parent component or trusted from the client.
 *
 * A tool can have more than one relevant check (ATS: quick vs tailored
 * scans; Interview: chat vs voice) — `status` is "available" if *any*
 * check still has capacity (the tool is still usable, just possibly with
 * a reduced capability), "locked" only if *every* check is a hard lock,
 * and "limit-reached" for the remaining case (accessible in principle,
 * but everything currently exhausted for this period).
 */
export async function getToolAccessState(userId: string, toolSlug: string): Promise<ToolAccessState> {
  const toolChecks = TOOL_ENTITLEMENT_CHECKS[toolSlug] ?? [];
  const checks = await Promise.all(toolChecks.map((check) => resolveCheck(userId, check)));

  const status: AccessStatus = checks.some((check) => check.status === "available")
    ? "available"
    : checks.every((check) => check.status === "locked")
      ? "locked"
      : "limit-reached";

  return { toolSlug, status, checks };
}

/** All 8 tools from src/config/tools.ts, in the same order. */
export async function getAllToolAccessStates(userId: string): Promise<ToolAccessState[]> {
  return Promise.all(TOOLS.map((tool) => getToolAccessState(userId, tool.slug)));
}
