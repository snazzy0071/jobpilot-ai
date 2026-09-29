"use client";

import { useActionState } from "react";
import { saveAboutStep } from "@/lib/onboarding/actions";
import type { OnboardingResult } from "@/lib/onboarding/actions";
import {
  CAREER_STAGES,
  CAREER_STAGE_LABELS,
  PRIMARY_GOALS,
  PRIMARY_GOAL_LABELS,
} from "@/lib/onboarding/schemas";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AboutForm({
  defaultCareerStage,
  defaultPrimaryGoal,
}: {
  defaultCareerStage: string | null;
  defaultPrimaryGoal: string | null;
}) {
  const [state, formAction, pending] = useActionState<OnboardingResult, FormData>(
    saveAboutStep,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
        <Label htmlFor="primaryGoal">What&apos;s your main goal right now?</Label>
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

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
