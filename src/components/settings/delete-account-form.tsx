"use client";

import { useActionState } from "react";
import { deleteAccount, type SettingsResult } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/settings/form-message";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(
    deleteAccount,
    undefined,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-3 rounded-lg border border-destructive/30 p-4">
      <p className="text-sm font-medium text-destructive">Delete account</p>
      <p className="text-sm text-muted-foreground">
        This permanently deletes your account and all data associated with it. This can&apos;t
        be undone.
      </p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirmation">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </Label>
        <Input id="confirmation" name="confirmation" type="text" required autoComplete="off" />
      </div>

      <FormMessage state={state} />

      <Button type="submit" variant="destructive" disabled={pending} className="self-start">
        {pending ? "Deleting..." : "Delete my account"}
      </Button>
    </form>
  );
}
