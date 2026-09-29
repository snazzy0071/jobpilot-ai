"use client";

import { useActionState } from "react";
import { updateCareerPreferences, type SettingsResult } from "@/lib/settings/actions";
import {
  CAREER_STAGES,
  CAREER_STAGE_LABELS,
  INDUSTRY_OPTIONS,
  industryFieldId,
  PRIMARY_GOALS,
  PRIMARY_GOAL_LABELS,
  VISA_SPONSORSHIP_LABELS,
  VISA_SPONSORSHIP_PREFERENCES,
} from "@/lib/onboarding/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormMessage } from "@/components/settings/form-message";

export function CareerPreferencesForm({
  defaultCareerStage,
  defaultPrimaryGoal,
  defaultTargetRoles,
  defaultIndustries,
  defaultLocation,
  defaultGraduationYear,
  defaultVisaPreference,
}: {
  defaultCareerStage: string | null;
  defaultPrimaryGoal: string | null;
  defaultTargetRoles: string[];
  defaultIndustries: string[];
  defaultLocation: string | null;
  defaultGraduationYear: number | null;
  defaultVisaPreference: string | null;
}) {
  const [state, formAction, pending] = useActionState<SettingsResult, FormData>(
    updateCareerPreferences,
    undefined,
  );

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="careerStage">Career stage</Label>
        <Select name="careerStage" required items={CAREER_STAGE_LABELS} defaultValue={defaultCareerStage ?? undefined}>
          <SelectTrigger id="careerStage" className="w-full">
            <SelectValue placeholder="Choose your career stage" />
          </SelectTrigger>
          <SelectContent>
            {CAREER_STAGES.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {CAREER_STAGE_LABELS[stage]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="primaryGoal">Main goal</Label>
        <Select name="primaryGoal" required items={PRIMARY_GOAL_LABELS} defaultValue={defaultPrimaryGoal ?? undefined}>
          <SelectTrigger id="primaryGoal" className="w-full">
            <SelectValue placeholder="Choose your main goal" />
          </SelectTrigger>
          <SelectContent>
            {PRIMARY_GOALS.map((goal) => (
              <SelectItem key={goal} value={goal}>
                {PRIMARY_GOAL_LABELS[goal]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="targetRoles">Target roles</Label>
        <Input
          id="targetRoles"
          name="targetRoles"
          type="text"
          required
          defaultValue={defaultTargetRoles.join(", ")}
          placeholder="e.g. Software Engineer, Data Analyst"
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          type="text"
          required
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

      <FormMessage state={state} />

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving..." : "Save preferences"}
      </Button>
    </form>
  );
}
