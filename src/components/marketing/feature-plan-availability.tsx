import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LABELS, PLAN_ORDER, planIncludes, type PlanTier } from "@/config/plans";

/** Which plan tiers include this specific feature — a one-row version of
 * the full /pricing comparison table, scoped to a single feature. */
export function FeaturePlanAvailability({ plan }: { plan: PlanTier }) {
  return (
    <div className="mx-auto grid max-w-2xl grid-cols-4 gap-3">
      {PLAN_ORDER.map((tier) => {
        const included = planIncludes(plan, tier);
        return (
          <div
            key={tier}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border p-3 text-center",
              included && "border-primary bg-primary/5",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {PLAN_LABELS[tier]}
            </p>
            {included ? (
              <Check className="size-4 text-primary" aria-label="Included" />
            ) : (
              <Minus className="size-4 text-muted-foreground/40" aria-label="Not included" />
            )}
          </div>
        );
      })}
    </div>
  );
}
