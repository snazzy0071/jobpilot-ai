"use client";

import { useActionState } from "react";
import { saveLogisticsStep } from "@/lib/onboarding/actions";
import type { OnboardingResult } from "@/lib/onboarding/actions";
import { VISA_SPONSORSHIP_LABELS, VISA_SPONSORSHIP_PREFERENCES } from "@/lib/onboarding/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LogisticsForm({
  defaultLocation,
  defaultGraduationYear,
  defaultVisaPreference,
}: {
  defaultLocation: string | null;
  defaultGraduationYear: number | null;
  defaultVisaPreference: string | null;
}) {
  const [state, formAction, pending] = useActionState<OnboardingResult, FormData>(
    saveLogisticsStep,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          type="text"
          required
          placeholder="e.g. London"
          defaultValue={defaultLocation ?? ""}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="graduationYear">Graduation year</Label>
        <Input
          id="graduationYear"
          name="graduationYear"
          type="number"
          required
          min={1950}
          max={2100}
          defaultValue={defaultGraduationYear ?? undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="visaSponsorshipPreference">Right to work / sponsorship</Label>
        <Select
          name="visaSponsorshipPreference"
          required
          items={VISA_SPONSORSHIP_LABELS}
          defaultValue={defaultVisaPreference ?? undefined}
        >
          <SelectTrigger id="visaSponsorshipPreference" className="w-full">
            <SelectValue placeholder="Choose an option" />
          </SelectTrigger>
          <SelectContent>
            {VISA_SPONSORSHIP_PREFERENCES.map((preference) => (
              <SelectItem key={preference} value={preference}>
                {VISA_SPONSORSHIP_LABELS[preference]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Finish"}
      </Button>
    </form>
  );
}
