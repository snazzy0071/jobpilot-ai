"use client";

import { useActionState } from "react";
import { resendSignupConfirmation, type ResendResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export function ResendConfirmationForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<ResendResult | undefined, FormData>(
    resendSignupConfirmation,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <input type="hidden" name="email" value={email} />

      {state && "error" in state && (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      )}
      {state && "sent" in state && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Confirmation email sent again.</p>
      )}

      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sending..." : "Resend confirmation email"}
      </Button>
    </form>
  );
}
