import type { FeatureKey, MeteredKey } from "@/lib/entitlements/types";

// Which entitlements each tool needs. Pure data, shared by the dashboard's tool cards (tool-access.ts) and by the public pages
// that say which plan includes a tool (src/lib/plans/plan-features.ts), so "which plan unlocks this" is read from one place, from
// the plans table, and can never drift from what the server actually enforces.
export type ToolAccessCheck =
  | { kind: "feature"; key: FeatureKey; label: string }
  | { kind: "metered"; key: MeteredKey; label: string };

export const TOOL_ENTITLEMENT_CHECKS: Record<string, ToolAccessCheck[]> = {
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
