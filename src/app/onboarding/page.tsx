import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOnboardingState, resolveNextStep } from "@/lib/onboarding/data";

export default async function OnboardingIndexPage() {
  const user = await requireUser();
  const { preferences } = await getOnboardingState(user.id);

  const step = resolveNextStep(preferences);
  redirect(step === "completed" ? "/dashboard" : `/onboarding/${step}`);
}
