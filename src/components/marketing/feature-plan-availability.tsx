import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LABELS, PLAN_ORDER, planIncludes, type PlanTier } from "@/config/plans";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { StaggerItem } from "@/components/motion/stagger-item";

/** Which plan tiers include this specific feature: a one-row version of
 * the full /pricing comparison table, scoped to a single feature. */
export function FeaturePlanAvailability({ plan }: { plan: PlanTier }) {
  return (
    <StaggerContainer className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4" staggerDelay={0.07}>
      {PLAN_ORDER.map((tier) => {
        const included = planIncludes(plan, tier);
        return (
          <StaggerItem
            key={tier}
            className={cn(
              "flex flex-col items-center gap-3 rounded-2xl border p-5 text-center transition-all",
              included
                ? "border-primary/40 bg-gradient-to-b from-primary/10 to-transparent shadow-card hover:-translate-y-0.5 hover:shadow-elevated"
                : "bg-muted/30 opacity-80",
            )}
          >
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{PLAN_LABELS[tier]}</p>
            {included ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-4" aria-label="Included" />
              </span>
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-muted">
                <Minus className="size-4 text-muted-foreground/60" aria-label="Not included" />
              </span>
            )}
          </StaggerItem>
        );
      })}
    </StaggerContainer>
  );
}
