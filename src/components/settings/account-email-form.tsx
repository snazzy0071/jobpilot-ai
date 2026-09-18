"use client";

import { useActionState } from "react";
import { updateAccountEmail, type SettingsResult } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/settings/form-message";

export function AccountEmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(
    updateAccountEmail,
    undefined,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={currentEmail ?? ""}
          autoComplete="email"
        />
        <p className="text-xs text-muted-foreground">
          Changing this sends a confirmation link to the new address before it takes effect.
        </p>
      </div>

      <FormMessage state={state} />

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Update email"}
      </Button>
    </form>
  );
}
