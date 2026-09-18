// Formats the plans.entitlements jsonb blob (see migration
// 0016_plan_entitlement_limits.sql) into a human-readable list — only
// what's actually included, so the settings page reflects the real
// configured limits instead of a hardcoded description that can drift
// from them. Unknown keys still render (title-cased) rather than
// disappearing, so a newly added entitlement is visible immediately
// without a UI change.

const ENTITLEMENT_LABELS: Record<string, string> = {
  cv_limit: "CVs",
  cv_template_count: "CV templates",
  quick_ats_scans_per_month: "Quick ATS scans",
  tailored_ats_scans_per_month: "Tailored ATS scans",
  cover_letter_generator: "Cover Letter Generator",
  linkedin_optimiser: "LinkedIn Optimiser",
  job_match: "Job Match",
  grad_scheme_prep: "Grad Scheme Prep",
  chat_interviews_per_month: "Chat interviews",
  voice_interviews_per_month: "Voice interviews",
  ai_operations_per_month: "AI operations",
  voice_topups_allowed: "Voice top-ups",
  job_tracker: "Job Tracker",
  visa_sponsor_register: "Visa Sponsor Register",
  support_tier: "Support",
};

function labelFor(key: string): string {
  return (
    ENTITLEMENT_LABELS[key] ??
    key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

export type FormattedEntitlement = { key: string; label: string; value: string };

export function formatEntitlements(entitlements: Record<string, unknown>): FormattedEntitlement[] {
  const entries: FormattedEntitlement[] = [];

  for (const [key, raw] of Object.entries(entitlements)) {
    // false / 0 means "not included" for this plan — omit rather than
    // list every excluded feature.
    if (raw === false || raw === 0) continue;

    const label = labelFor(key);

    if (raw === null) {
      entries.push({ key, label, value: "Unlimited" });
    } else if (raw === true) {
      entries.push({ key, label, value: "Included" });
    } else if (typeof raw === "number") {
      const suffix = key.endsWith("_per_month") ? "/month" : "";
      entries.push({ key, label, value: `${raw}${suffix}` });
    } else if (typeof raw === "string") {
      entries.push({ key, label, value: raw.charAt(0).toUpperCase() + raw.slice(1) });
    }
  }

  return entries;
}
