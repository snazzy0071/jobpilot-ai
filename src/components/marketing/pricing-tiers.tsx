"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PricingCard } from "@/components/marketing/pricing-card";
import { formatPounds, monthsFreeAnnually, planBullets, sortPlans, type PublicPlan } from "@/lib/plans/plan-features";
import { cn } from "@/lib/utils";

// Taglines are marketing copy; everything else on a card (price, what it includes) is worked out from the plan's own row in the
// `plans` table (src/lib/plans/plan-features.ts), the same entitlements the server enforces.
const TAGLINES: Record<string, { description: string; popular?: boolean }> = {
  free: { description: "To get started." },
  pro: { description: "For getting your applications in shape." },
  premium: { description: "For actively interviewing.", popular: true },
  elite: { description: "For the full toolkit." },
};

export function PricingTiers({ plans }: { plans: PublicPlan[] }) {
  const [annual, setAnnual] = useState(false);
  const ordered = sortPlans(plans);
  const savings = Math.max(0, ...ordered.map(monthsFreeAnnually));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm", !annual ? "font-medium text-foreground" : "text-muted-foreground")}>Monthly</span>
        <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Toggle annual billing" />
        <span className={cn("text-sm", annual ? "font-medium text-foreground" : "text-muted-foreground")}>Annual</span>
        {savings > 0 && <Badge variant="secondary">{savings} months free</Badge>}
      </div>

      <div className={cn("grid gap-6", ordered.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {ordered.map((plan, index) => {
          const tagline = TAGLINES[plan.slug] ?? { description: "" };
          const isFree = plan.monthlyPence === 0;
          return (
            <PricingCard
              key={plan.slug}
              name={plan.name}
              price={isFree ? "£0" : formatPounds(annual ? plan.annualPence : plan.monthlyPence)}
              period={isFree ? "forever" : annual ? "/year" : "/month"}
              description={tagline.description}
              features={planBullets(plan, index > 0 ? ordered[index - 1] : null)}
              popular={tagline.popular}
              ctaLabel={isFree ? "Create free account" : "Get started"}
              ctaHref="/signup"
            />
          );
        })}
      </div>
    </div>
  );
}
