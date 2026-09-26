"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { eraseUserAccount } from "@/lib/account/erase-account";
import { verifyCurrentPassword } from "@/lib/auth/reauth";
import {
  careerPreferencesSchema,
  deleteAccountSchema,
  notificationsSchema,
  profileSchema,
  updateAccountPasswordSchema,
  updateEmailSchema,
} from "@/lib/settings/schemas";

export type SettingsResult = { error: string } | { success: string } | void;

export async function updateProfile(
  _prevState: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, date_of_birth: parsed.data.dateOfBirth })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: "Profile updated." };
}

export async function updateCareerPreferences(
  _prevState: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = careerPreferencesSchema.safeParse({
    careerStage: formData.get("careerStage"),
    primaryGoal: formData.get("primaryGoal"),
    targetRoles: formData.get("targetRoles"),
    industries: formData.getAll("industries"),
    location: formData.get("location"),
    graduationYear: formData.get("graduationYear"),
    visaSponsorshipPreference: formData.get("visaSponsorshipPreference"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("user_preferences")
    .update({
      career_stage: parsed.data.careerStage,
      primary_goal: parsed.data.primaryGoal,
      target_roles: parsed.data.targetRoles,
      industries: parsed.data.industries,
      location: parsed.data.location,
      graduation_year: parsed.data.graduationYear,
      visa_sponsorship_preference: parsed.data.visaSponsorshipPreference,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: "Career preferences updated." };
}

export async function updateAccountEmail(
  _prevState: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = updateEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const reauth = await verifyCurrentPassword(user, formData.get("currentPassword"));
  if (reauth) return { error: reauth };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/dashboard/settings` },
  );
  if (error) return { error: error.message };

  return { success: "Check your inbox to confirm the new email address." };
}

export async function updateAccountPassword(
  _prevState: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = updateAccountPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const reauth = await verifyCurrentPassword(user, formData.get("currentPassword"));
  if (reauth) return { error: reauth };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { success: "Password updated." };
}

export async function updateNotifications(
  _prevState: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = notificationsSchema.safeParse({
    newsletterOptIn: formData.get("newsletterOptIn"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const update: { newsletter_opt_in: boolean; newsletter_opt_in_at?: string } = {
    newsletter_opt_in: parsed.data.newsletterOptIn,
  };
  if (parsed.data.newsletterOptIn) update.newsletter_opt_in_at = new Date().toISOString();

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: "Notification preferences updated." };
}

export async function unlinkProvider(
  _prevState: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  await requireUser();
  const identityId = String(formData.get("identityId") ?? "");
  if (!identityId) return { error: "Missing connection." };

  const supabase = await createClient();
  const { data, error: listError } = await supabase.auth.getUserIdentities();
  if (listError) return { error: listError.message };

  const identity = data?.identities.find((candidate) => candidate.identity_id === identityId);
  if (!identity) return { error: "That connection no longer exists." };

  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings");
  return { success: "Disconnected." };
}

export async function deleteAccount(
  _prevState: SettingsResult,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireUser();
  const parsed = deleteAccountSchema.safeParse({
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const reauth = await verifyCurrentPassword(user, formData.get("currentPassword"));
  if (reauth) return { error: reauth };

  const result = await eraseUserAccount(user.id);
  if ("error" in result) return { error: result.error };

  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
