"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { BillingActionResult } from "@/lib/billing/actions";

type BoundBillingAction = (prevState: BillingActionResult, formData: FormData) => Promise<BillingActionResult>;

export function BillingActionButton({
  action,
  label,
  pendingLabel,
  variant = "outline",
}: {
  action: BoundBillingAction;
  label: string;
  pendingLabel?: string;
  variant?: "outline" | "destructive" | "default" | "secondary" | "ghost" | "link";
}) {
  const [state, formAction, pending] = useActionState<BillingActionResult, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Button type="submit" variant={variant} size="sm" disabled={pending}>
        {pending ? (pendingLabel ?? "Working...") : label}
      </Button>
      {state && "error" in state ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
