"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UpgradeButton } from "@/components/settings/upgrade-button";
import { BillingActionButton } from "@/components/settings/billing-action-button";
import {
  createBillingPortalSession,
  cancelSubscription,
  reactivateSubscription,
  changeSubscriptionPlan,
} from "@/lib/billing/actions";
import { formatEntitlements } from "@/lib/billing/entitlements-display";
import { hasLiveStripeSubscription } from "@/lib/billing/subscription-state";
import type { CurrentSubscription } from "@/lib/billing/queries";
import { PLAN_LABELS, PLAN_PRICING } from "@/config/plans";
import { PAID_PLAN_SLUGS, BILLING_CYCLES, type BillingCycle } from "@/lib/billing/types";
import { purchaseVoiceTopup } from "@/lib/interviews/topup-actions";
import { VOICE_TOPUP_CREDITS } from "@/lib/interviews/topup-config";
import type { UsageCheck } from "@/lib/entitlements/types";

const STATUS_BADGE_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  active: "secondary",
  trialing: "secondary",
  past_due: "destructive",
  canceled: "outline",
  incomplete: "outline",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function UpgradeCycleTiers({ cycle, onCycleChange }: { cycle: BillingCycle; onCycleChange: (cycle: BillingCycle) => void }) {
  return (
    <div className="flex flex-col gap-3" data-testid="upgrade-tiers">
      <Tabs value={cycle} onValueChange={(value) => onCycleChange(value as BillingCycle)}>
        <TabsList>
          {BILLING_CYCLES.map((option) => (
            <TabsTrigger key={option} value={option} className="capitalize">
              {option}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-2">
        {PAID_PLAN_SLUGS.map((slug) => (
          <UpgradeButton
            key={slug}
            planSlug={slug}
            billingCycle={cycle}
            label={`${PLAN_LABELS[slug]} — £${PLAN_PRICING[slug][cycle]}/${cycle === "monthly" ? "mo" : "yr"}`}
          />
        ))}
      </div>
    </div>
  );
}

export type EffectivePlan = {
  planSlug: string;
  planName: string;
  /** Where the plan in force comes from: the person's own subscription/grant, their institution's licence, or Free. */
  source: "subscription" | "institution" | "free";
  entitlements: Record<string, unknown>;
};

// `subscription` is the person's OWN subscriptions row (kept current by Stripe's webhooks), and decides what they can manage here.
// `effective` is the plan actually in force, from the entitlement service: their own plan, or their institution's licence when that
// is better, or Free. Everything shown as "your plan" and "what's included" comes from `effective`, never from the URL.
export function BillingPanel({
  subscription,
  effective,
  voiceUsage,
  voiceTopupsAllowed,
}: {
  subscription: CurrentSubscription | null;
  effective: EffectivePlan;
  /** Live voice_interviews_per_month usage (src/lib/entitlements/service.ts's checkUsageAllowed), including any top-up credits already folded into its limit/remaining. */
  voiceUsage: UsageCheck | null;
  voiceTopupsAllowed: boolean;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  const live = hasLiveStripeSubscription(subscription ? { status: subscription.status, stripe_subscription_id: subscription.hasStripeSubscription ? "x" : null } : null);
  const entitlementRows = formatEntitlements(effective.entitlements);
  const currentSlug = subscription?.planSlug;
  const currentCycle = subscription?.billingCycle === "annual" ? "annual" : "monthly";
  const otherCycle: BillingCycle = currentCycle === "annual" ? "monthly" : "annual";
  const otherPaidPlans = PAID_PLAN_SLUGS.filter((slug) => slug !== currentSlug);
  const grantedNotBilled = Boolean(subscription) && !live && effective.source === "subscription";

  let detail: string;
  if (effective.source === "institution") {
    detail = "Provided by your institution's licence while it is in force.";
  } else if (effective.source === "free") {
    detail = "Upgrade below for more of the toolkit.";
  } else if (live && subscription?.cancelAtPeriodEnd && subscription.currentPeriodEnd) {
    detail = `Ends on ${formatDate(subscription.currentPeriodEnd)}. No further charges after that.`;
  } else if (live && subscription?.currentPeriodEnd) {
    detail = `Renews on ${formatDate(subscription.currentPeriodEnd)}.`;
  } else if (grantedNotBilled) {
    detail = "Granted to your account (for example by an access code). You aren't being billed for it.";
  } else {
    detail = "Manage your subscription below.";
  }

  return (
    <div className="flex max-w-md flex-col gap-4" data-testid="billing-panel" data-plan={effective.planSlug} data-source={effective.source}>
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-sm font-medium">Current plan</p>
          <p className="text-xs text-muted-foreground" data-testid="billing-detail">
            {detail}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="secondary" data-testid="billing-plan-name">
            {effective.planName}
          </Badge>
          {subscription && subscription.status !== "active" && effective.source !== "institution" && (
            <Badge variant={STATUS_BADGE_VARIANT[subscription.status] ?? "outline"} className="capitalize">
              {subscription.status.replace("_", " ")}
            </Badge>
          )}
        </div>
      </div>

      {subscription?.status === "past_due" && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="billing-past-due">
          Your last payment didn&apos;t go through. Your plan stays active while Stripe retries, but update your payment details to avoid losing access.
        </p>
      )}
      {subscription && !live && subscription.hasStripeSubscription && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm" data-testid="billing-ended">
          Your previous subscription has ended, so you&apos;re on {effective.planName} now. You can subscribe again below.
        </p>
      )}

      {entitlementRows.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">What&apos;s included</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {entitlementRows.map((entry) => (
              <li key={entry.key} className="flex justify-between gap-2">
                <span>{entry.label}</span>
                <span className="font-medium text-foreground">{entry.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {voiceUsage && voiceUsage.limit !== 0 && (
        <div className="flex flex-col gap-2 rounded-lg border p-4" data-testid="billing-voice">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Voice interviews this month</p>
            <p className="text-xs text-muted-foreground">
              {voiceUsage.limit === null ? "Unlimited" : `${voiceUsage.used} of ${voiceUsage.limit} used`}
            </p>
          </div>
          {voiceUsage.limit !== null && voiceUsage.remaining === 0 && (
            <>
              {voiceTopupsAllowed ? (
                <BillingActionButton
                  action={purchaseVoiceTopup.bind(null, "/dashboard/settings?tab=billing")}
                  label={`Buy ${VOICE_TOPUP_CREDITS} more voice interviews`}
                  pendingLabel="Starting checkout…"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  <Link href="/pricing" className="underline">
                    Upgrade to Elite
                  </Link>{" "}
                  for more voice interviews this month.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {!live && <UpgradeCycleTiers cycle={cycle} onCycleChange={setCycle} />}

      {live && subscription && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">Change plan</p>
            <div className="flex flex-wrap gap-2">
              {otherPaidPlans.map((slug) => (
                <BillingActionButton
                  key={slug}
                  action={changeSubscriptionPlan.bind(null, slug, currentCycle)}
                  label={`Switch to ${PLAN_LABELS[slug]}`}
                  pendingLabel="Updating..."
                />
              ))}
              {currentSlug && (PAID_PLAN_SLUGS as readonly string[]).includes(currentSlug) && (
                <BillingActionButton
                  action={changeSubscriptionPlan.bind(null, currentSlug as (typeof PAID_PLAN_SLUGS)[number], otherCycle)}
                  label={`Switch to ${otherCycle} billing`}
                  pendingLabel="Updating..."
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <BillingActionButton action={createBillingPortalSession} label="Manage billing" pendingLabel="Opening..." />
            {subscription.cancelAtPeriodEnd ? (
              <BillingActionButton action={reactivateSubscription} label="Reactivate" pendingLabel="Reactivating..." />
            ) : (
              <BillingActionButton action={cancelSubscription} label="Cancel subscription" pendingLabel="Canceling..." variant="ghost" />
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Or see the full{" "}
        <Link href="/pricing" className="underline">
          plan comparison
        </Link>
        .
      </p>
    </div>
  );
}
