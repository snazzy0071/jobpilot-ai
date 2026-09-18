import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/onboarding/data";
import { TargetsForm } from "@/components/onboarding/targets-form";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { SkipOnboardingButton } from "@/components/onboarding/skip-button";

export default async function OnboardingTargetsPage() {
  const user = await requireUser();
  const { preferences } = await getOnboardingState(user.id);

  return (
    <Card>
      {/* sr-only real <h1> — see src/app/onboarding/about/page.tsx's own comment. */}
      <h1 className="sr-only">What are you looking for?</h1>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <StepIndicator current={2} />
          <SkipOnboardingButton />
        </div>
        <CardTitle>What are you looking for?</CardTitle>
      </CardHeader>
      <CardContent>
        <TargetsForm
          defaultTargetRoles={preferences?.target_roles ?? []}
          defaultIndustries={preferences?.industries ?? []}
        />
      </CardContent>
    </Card>
  );
}
