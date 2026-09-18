"use client";

import { useActionState } from "react";
import { updateNotifications, type SettingsResult } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FormMessage } from "@/components/settings/form-message";

export function NotificationsForm({ defaultOptIn }: { defaultOptIn: boolean }) {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(
    updateNotifications,
    undefined,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex items-start gap-2">
        <Checkbox
          id="newsletterOptIn"
          name="newsletterOptIn"
          value="on"
          defaultChecked={defaultOptIn}
          className="mt-0.5"
        />
        <Label htmlFor="newsletterOptIn" className="text-sm font-normal">
          Send me occasional emails about new features and career tips. You can unsubscribe
          anytime.
        </Label>
      </div>

      <FormMessage state={state} />

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
