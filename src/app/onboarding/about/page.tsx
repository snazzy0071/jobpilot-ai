import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState } from "@/lib/onboarding/data";
import { AboutForm } from "@/components/onboarding/about-form";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { SkipOnboardingButton } from "@/components/onboarding/skip-button";

export default async function OnboardingAboutPage() {
  const user = await requireUser();
  const { preferences } = await getOnboardingState(user.id);

  return (
    <Card>
      {/* sr-only real <h1> — same fix as the (auth) route group's own
          pages (see src/app/(auth)/login/page.tsx's comment): this
          page's only visible heading is CardTitle, an <h2>. */}
      <h1 className="sr-only">Tell us about yourself</h1>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <StepIndicator current={1} />
          <SkipOnboardingButton />
        </div>
        <CardTitle>Tell us about yourself</CardTitle>
      </CardHeader>
      <CardContent>
        <AboutForm
          defaultCareerStage={preferences?.career_stage ?? null}
          defaultPrimaryGoal={preferences?.primary_goal ?? null}
        />
      </CardContent>
    </Card>
  );
}
