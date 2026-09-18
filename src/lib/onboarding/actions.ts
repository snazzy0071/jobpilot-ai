"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  aboutStepSchema,
  logisticsStepSchema,
  targetsStepSchema,
} from "@/lib/onboarding/schemas";

export type OnboardingResult = { error: string } | void;

export async function saveAboutStep(
  _prevState: OnboardingResult,
  formData: FormData,
): Promise<OnboardingResult> {
  const user = await requireUser();

  const parsed = aboutStepSchema.safeParse({
    careerStage: formData.get("careerStage"),
    primaryGoal: formData.get("primaryGoal"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .update({
      career_stage: parsed.data.careerStage,
      primary_goal: parsed.data.primaryGoal,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  // First step touched — mark progress started. Scoped to not_started
  // only, so revisiting this step later can't regress a completed run.
  await supabase
    .from("profiles")
    .update({ onboarding_status: "in_progress" })
    .eq("id", user.id)
    .eq("onboarding_status", "not_started");

  redirect("/onboarding/targets");
}

export async function saveTargetsStep(
  _prevState: OnboardingResult,
  formData: FormData,
): Promise<OnboardingResult> {
  const user = await requireUser();

  const parsed = targetsStepSchema.safeParse({
    targetRoles: formData.get("targetRoles"),
    industries: formData.getAll("industries"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .update({
      target_roles: parsed.data.targetRoles,
      industries: parsed.data.industries,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  redirect("/onboarding/logistics");
}

export async function saveLogisticsStep(
  _prevState: OnboardingResult,
  formData: FormData,
): Promise<OnboardingResult> {
  const user = await requireUser();

  const parsed = logisticsStepSchema.safeParse({
    location: formData.get("location"),
    graduationYear: formData.get("graduationYear"),
    visaSponsorshipPreference: formData.get("visaSponsorshipPreference"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error: preferencesError } = await supabase
    .from("user_preferences")
    .update({
      location: parsed.data.location,
      graduation_year: parsed.data.graduationYear,
      visa_sponsorship_preference: parsed.data.visaSponsorshipPreference,
    })
    .eq("id", user.id);

  if (preferencesError) {
    return { error: preferencesError.message };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarding_status: "completed" })
    .eq("id", user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function skipOnboarding() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarding_status: "completed" }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
