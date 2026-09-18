"use client";

import { useActionState } from "react";
import { updateProfile, type SettingsResult } from "@/lib/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "@/components/settings/form-message";

const today = new Date().toISOString().slice(0, 10);

export function ProfileForm({
  defaultFullName,
  defaultDateOfBirth,
}: {
  defaultFullName: string | null;
  defaultDateOfBirth: string | null;
}) {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(
    updateProfile,
    undefined,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          required
          defaultValue={defaultFullName ?? ""}
          autoComplete="name"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          required
          max={today}
          defaultValue={defaultDateOfBirth ?? ""}
          autoComplete="bday"
        />
      </div>

      <FormMessage state={state} />

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}
