// Single source of truth for plan-tier metadata — /pricing and every
// FeaturePage's badge/comparison/CTA all read from here, so "which tier
// unlocks this" can never drift between the two.

export const PLAN_ORDER = ["free", "pro", "premium", "elite"] as const;

export type PlanTier = (typeof PLAN_ORDER)[number];

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
  elite: "Elite",
};

export const PLAN_PRICING: Record<Exclude<PlanTier, "free">, { monthly: number; annual: number }> = {
  pro: { monthly: 6, annual: 60 },
  premium: { monthly: 15, annual: 150 },
  elite: { monthly: 25, annual: 250 },
};

export function planIncludes(minimumPlan: PlanTier, candidate: PlanTier) {
  return PLAN_ORDER.indexOf(candidate) >= PLAN_ORDER.indexOf(minimumPlan);
}
