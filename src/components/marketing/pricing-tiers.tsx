"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PricingCard } from "@/components/marketing/pricing-card";
import { PLAN_LABELS, PLAN_PRICING, type PlanTier } from "@/config/plans";
import { cn } from "@/lib/utils";

type PaidTier = Exclude<PlanTier, "free">;

const TIER_COPY: Record<PaidTier, { description: string; features: string[]; popular?: boolean }> = {
  pro: {
    description: "For getting your applications in shape.",
    features: [
      "Everything in Free",
      "Unlimited CVs & templates",
      "AI bullet rewriting",
      "Cover Letter Generator",
      "LinkedIn Optimiser",
    ],
  },
  premium: {
    description: "For actively interviewing.",
    features: ["Everything in Pro", "AI Interview Coach (text)", "Job Match Engine", "Grad Scheme Prep"],
    popular: true,
  },
  elite: {
    description: "For the full toolkit.",
    features: ["Everything in Premium", "Voice Interview Coach", "Priority support"],
  },
};

const PAID_TIERS: PaidTier[] = ["pro", "premium", "elite"];

export function PricingTiers() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm", !annual ? "font-medium text-foreground" : "text-muted-foreground")}>
          Monthly
        </span>
        <Switch checked={annual} onCheckedChange={setAnnual} aria-label="Toggle annual billing" />
        <span className={cn("text-sm", annual ? "font-medium text-foreground" : "text-muted-foreground")}>
          Annual
        </span>
        <Badge variant="secondary">2 months free</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <PricingCard
          name="Free"
          price="£0"
          period="forever"
          description="To get started."
          features={[
            "1 saved CV",
            "Unlimited ATS scans",
            "Job Tracker",
            "UK Visa Sponsor Register search",
          ]}
          ctaLabel="Create free account"
          ctaHref="/signup"
        />
        {PAID_TIERS.map((tier) => {
          const pricing = PLAN_PRICING[tier];
          const copy = TIER_COPY[tier];
          return (
            <PricingCard
              key={tier}
              name={PLAN_LABELS[tier]}
              price={`£${annual ? pricing.annual : pricing.monthly}`}
              period={annual ? "/year" : "/month"}
              description={copy.description}
              features={copy.features}
              popular={copy.popular}
              ctaLabel="Get started"
              ctaHref={`/signup?plan=${tier}`}
            />
          );
        })}
      </div>
    </div>
  );
}
