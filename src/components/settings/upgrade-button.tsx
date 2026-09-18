"use client";

import { useActionState } from "react";
import { createCheckoutSession, type CheckoutResult } from "@/lib/billing/actions";
import type { PaidPlanSlug, BillingCycle } from "@/lib/billing/types";
import { Button } from "@/components/ui/button";

export function UpgradeButton({
  planSlug,
  billingCycle,
  label,
}: {
  planSlug: PaidPlanSlug;
  billingCycle: BillingCycle;
  label: string;
}) {
  const boundAction = createCheckoutSession.bind(null, planSlug, billingCycle);
  const [state, formAction, pending] = useActionState<CheckoutResult, FormData>(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Redirecting..." : label}
      </Button>
      {state && "error" in state ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
