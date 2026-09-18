"use client";

import { useActionState } from "react";
import { updateAccountPassword, type SettingsResult } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/settings/form-message";

export function AccountPasswordForm() {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(
    updateAccountPassword,
    undefined,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>

      <FormMessage state={state} />

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
