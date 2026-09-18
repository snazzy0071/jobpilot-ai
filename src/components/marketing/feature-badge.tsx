import { Badge } from "@/components/ui/badge";
import { PLAN_LABELS, type PlanTier } from "@/config/plans";

export function FeatureBadge({ plan }: { plan: PlanTier }) {
  const label = plan === "free" ? "Included in every plan" : `Included from ${PLAN_LABELS[plan]}`;
  return <Badge variant="secondary">{label}</Badge>;
}
