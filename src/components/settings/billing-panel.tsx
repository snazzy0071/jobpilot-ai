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
    <div className="flex flex-col gap-3">
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

// `currentSubscription` comes from src/lib/billing/queries.ts — real
// data from `subscriptions` joined with `plans`, kept current by Stripe
// webhooks. `fallbackPlan` is the older profiles.plan free/paid flag,
// used only when currentSubscription is null (billing migrations not
// applied in this environment, or genuinely no row yet) so this never
// fabricates plan details it doesn't actually have.
export function BillingPanel({
  currentSubscription,
  fallbackPlan,
  voiceUsage,
  voiceTopupsAllowed,
}: {
  currentSubscription: CurrentSubscription | null;
  fallbackPlan: string;
  /** Live voice_interviews_per_month usage (src/lib/entitlements/service.ts's checkUsageAllowed), including any top-up credits already folded into its limit/remaining — a real count, not the static plan number formatEntitlements shows below. */
  voiceUsage: UsageCheck | null;
  voiceTopupsAllowed: boolean;
}) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  if (!currentSubscription) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-sm font-medium">Current plan</p>
            <p className="text-xs text-muted-foreground">Billing details aren&apos;t available right now.</p>
          </div>
          <Badge variant="secondary" className="capitalize">
            {fallbackPlan} plan
          </Badge>
        </div>
        {fallbackPlan === "free" && <UpgradeCycleTiers cycle={cycle} onCycleChange={setCycle} />}
      </div>
    );
  }

  const { planSlug, planName, status, cancelAtPeriodEnd, currentPeriodEnd, billingCycle, entitlements } =
    currentSubscription;
  const isFree = planSlug === "free";
  const entitlementRows = formatEntitlements(entitlements);
  const otherPaidPlans = PAID_PLAN_SLUGS.filter((slug) => slug !== planSlug);

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border p-4">
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-sm font-medium">Current plan</p>
          <p className="text-xs text-muted-foreground">
            {isFree
              ? "Upgrade below for more of the toolkit."
              : cancelAtPeriodEnd && currentPeriodEnd
                ? `Ends on ${formatDate(currentPeriodEnd)} — no further charges after that.`
                : currentPeriodEnd
                  ? `Renews on ${formatDate(currentPeriodEnd)}.`
                  : "Manage your subscription below."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="secondary">{planName}</Badge>
          {status !== "active" && (
            <Badge variant={STATUS_BADGE_VARIANT[status] ?? "outline"} className="capitalize">
              {status.replace("_", " ")}
            </Badge>
          )}
        </div>
      </div>

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
        <div className="flex flex-col gap-2 rounded-lg border p-4">
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

      {isFree && <UpgradeCycleTiers cycle={cycle} onCycleChange={setCycle} />}

      {!isFree && (
        <div className="flex flex-col gap-3">
          {otherPaidPlans.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Change plan</p>
              <div className="flex flex-wrap gap-2">
                {otherPaidPlans.map((slug) => (
                  <BillingActionButton
                    key={slug}
                    action={changeSubscriptionPlan.bind(null, slug, billingCycle === "annual" ? "annual" : "monthly")}
                    label={`Switch to ${PLAN_LABELS[slug]}`}
                    pendingLabel="Updating..."
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <BillingActionButton action={createBillingPortalSession} label="Manage billing" pendingLabel="Opening..." />
            {cancelAtPeriodEnd ? (
              <BillingActionButton action={reactivateSubscription} label="Reactivate" pendingLabel="Reactivating..." />
            ) : (
              <BillingActionButton
                action={cancelSubscription}
                label="Cancel subscription"
                pendingLabel="Canceling..."
                variant="ghost"
              />
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
