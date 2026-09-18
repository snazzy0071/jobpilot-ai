// The entitlement keys the app actually gates on today, matching
// migration 0016_plan_entitlement_limits.sql's seeded shape. Kept as a
// plain string-literal union rather than a strict interface for
// `plans.entitlements` itself — that column is deliberately schema-less
// jsonb (see that migration's comments on "configurable") so a new key
// can be added there without a type change here; these unions are just
// the keys current call sites are allowed to ask about, checked safely
// at read time in service.ts rather than assumed to exist.

export type FeatureKey =
  | "cover_letter_generator"
  | "linkedin_optimiser"
  | "job_match"
  | "grad_scheme_prep"
  | "job_tracker"
  | "visa_sponsor_register"
  | "voice_topups_allowed";

export type MeteredKey =
  | "cv_limit"
  | "cv_template_count"
  | "quick_ats_scans_per_month"
  | "tailored_ats_scans_per_month"
  | "chat_interviews_per_month"
  | "voice_interviews_per_month"
  | "ai_operations_per_month";

export type UsageCheck = {
  allowed: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
};
