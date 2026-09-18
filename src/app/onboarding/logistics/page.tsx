import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/onboarding/data";
import { LogisticsForm } from "@/components/onboarding/logistics-form";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { SkipOnboardingButton } from "@/components/onboarding/skip-button";

export default async function OnboardingLogisticsPage() {
  const user = await requireUser();
  const { preferences } = await getOnboardingState(user.id);

  return (
    <Card>
      {/* sr-only real <h1> — see src/app/onboarding/about/page.tsx's own comment. */}
      <h1 className="sr-only">A couple of logistics</h1>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <StepIndicator current={3} />
          <SkipOnboardingButton />
        </div>
        <CardTitle>A couple of logistics</CardTitle>
      </CardHeader>
      <CardContent>
        <LogisticsForm
          defaultLocation={preferences?.location ?? null}
          defaultGraduationYear={preferences?.graduation_year ?? null}
          defaultVisaPreference={preferences?.visa_sponsorship_preference ?? null}
        />
      </CardContent>
    </Card>
  );
}
