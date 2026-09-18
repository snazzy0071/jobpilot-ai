import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OnboardingStep = "about" | "targets" | "logistics";

export async function getOnboardingState(userId: string) {
  const supabase = await createClient();

  const [{ data: profile }, { data: preferences }] = await Promise.all([
    supabase.from("profiles").select("onboarding_status").eq("id", userId).single(),
    supabase.from("user_preferences").select("*").eq("id", userId).single(),
  ]);

  return { profile, preferences };
}

/** Resumes at the first step with missing data — not a stored pointer, so
 * it can never drift out of sync with what's actually been saved. */
export function resolveNextStep(
  preferences: {
    career_stage: string | null;
    primary_goal: string | null;
    target_roles: string[] | null;
    industries: string[] | null;
    location: string | null;
    graduation_year: number | null;
    visa_sponsorship_preference: string | null;
  } | null,
): OnboardingStep | "completed" {
  if (!preferences) return "about";
  if (!preferences.career_stage || !preferences.primary_goal) return "about";
  if (!preferences.target_roles?.length || !preferences.industries?.length) return "targets";
  if (
    !preferences.location ||
    !preferences.graduation_year ||
    !preferences.visa_sponsorship_preference
  ) {
    return "logistics";
  }
  return "completed";
}
