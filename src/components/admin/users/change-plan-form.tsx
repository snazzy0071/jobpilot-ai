"use client";

import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { changeUserPlanByAdmin, type ChangeUserPlanResult } from "@/lib/admin/users/actions";

export type ChangePlanOption = { slug: string; name: string };

/** Admin → Users → one user: put the account on any plan without payment (testers, the client, staff). */
export function ChangePlanForm({
  userId,
  currentPlanSlug,
  plans,
  billedThroughStripe,
}: {
  userId: string;
  currentPlanSlug: string;
  plans: ChangePlanOption[];
  billedThroughStripe: boolean;
}) {
  const [state, formAction, pending] = useActionState<ChangeUserPlanResult, FormData>(changeUserPlanByAdmin, undefined);

  if (billedThroughStripe) {
    return (
      <p className="text-sm text-muted-foreground">
        This account pays through Stripe, so its plan can only be changed in Stripe.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Label htmlFor="planSlug">Change plan</Label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1">
          <NativeSelect id="planSlug" name="planSlug" defaultValue={currentPlanSlug}>
            {plans.map((plan) => (
              <option key={plan.slug} value={plan.slug}>
                {plan.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          Save plan
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Takes effect immediately and costs the user nothing. Logged in admin activity.</p>
      {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
      {state && "success" in state && <p className="text-sm text-emerald-600 dark:text-emerald-400">{state.success}</p>}
    </form>
  );
}
