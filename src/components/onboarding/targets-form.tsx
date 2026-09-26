"use client";

import { useActionState } from "react";
import { saveTargetsStep } from "@/lib/onboarding/actions";
import type { OnboardingResult } from "@/lib/onboarding/actions";
import { INDUSTRY_OPTIONS, industryFieldId } from "@/lib/onboarding/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function TargetsForm({
  defaultTargetRoles,
  defaultIndustries,
}: {
  defaultTargetRoles: string[];
  defaultIndustries: string[];
}) {
  const [state, formAction, pending] = useActionState<OnboardingResult, FormData>(
    saveTargetsStep,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="targetRoles">Target roles</Label>
        <Input
          id="targetRoles"
          name="targetRoles"
          type="text"
          required
          placeholder="e.g. Software Engineer, Data Analyst"
          defaultValue={defaultTargetRoles.join(", ")}
        />
        <p className="text-xs text-muted-foreground">Separate multiple roles with commas.</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Industries</Label>
        <div className="grid grid-cols-2 gap-2">
          {INDUSTRY_OPTIONS.map((industry) => (
            <div key={industry} className="flex items-center gap-2">
              <Checkbox
                id={industryFieldId(industry)}
                name="industries"
                value={industry}
                defaultChecked={defaultIndustries.includes(industry)}
              />
              <Label htmlFor={industryFieldId(industry)} className="text-sm font-normal">
                {industry}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
