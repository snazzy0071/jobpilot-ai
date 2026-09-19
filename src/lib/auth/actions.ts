"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { parseRedirectParam } from "@/lib/auth/safe-redirect";
import { getRoleHomePath } from "@/lib/auth/role-redirect";
import { getAppSettings } from "@/lib/admin/settings/queries";
import {
  consumePasswordResetRateLimit,
  consumeResendConfirmationRateLimit,
  consumeSignInRateLimit,
  consumeSignUpRateLimit,
  AUTH_RATE_LIMIT_MESSAGE,
} from "@/lib/auth/rate-limit";
import {
  requestPasswordResetSchema,
  resendSignupConfirmationSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/auth/schemas";

export type AuthResult = { error: string } | void;

export async function signInWithPassword(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  if (!(await consumeSignInRateLimit())) {
    return { error: AUTH_RATE_LIMIT_MESSAGE };
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    // formData.get() returns null when the hidden field was omitted
    // (LoginForm only renders it when there's a real redirectTo) —
    // coerced to undefined here since signInSchema's redirectTo is
    // `.optional()`, which zod treats as "must be undefined, not null".
    redirectTo: formData.get("redirectTo") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { email, password, redirectTo } = parsed.data;

  const supabase = await createClient();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // An explicit redirect (bounced here from a protected page) wins;
  // otherwise this is the signed-in user's OWN role home — admin ->
  // /admin, institution_admin -> /institution-admin, user -> /dashboard
  // — never a hardcoded /dashboard regardless of role.
  const explicitRedirect = parseRedirectParam(redirectTo);
  let target = explicitRedirect;
  if (!target) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signInData.user.id)
      .single();
    target = getRoleHomePath(profile?.role);
  }

  revalidatePath("/", "layout");
  redirect(target);
}

export async function signUpWithPassword(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  if (!(await consumeSignUpRateLimit())) {
    return { error: AUTH_RATE_LIMIT_MESSAGE };
  }

  // The one real consumer of app_settings.maintenance_mode (migration
  // 0078) — checked before any other work, same "fail fast on an
  // obviously bad request before creating an account" spirit the
  // access-code pre-check below already has. Existing sessions are
  // untouched; this only ever blocks a brand-new signup.
  const { maintenanceMode } = await getAppSettings();
  if (maintenanceMode) {
    return { error: "Signups are temporarily paused for maintenance — please check back soon." };
  }

  const parsed = signUpSchema.safeParse({
    mode: formData.get("mode"),
    accessCode: formData.get("accessCode"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    dateOfBirth: formData.get("dateOfBirth"),
    newsletterOptIn: formData.get("newsletterOptIn"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { mode, accessCode, email, password, fullName, dateOfBirth, newsletterOptIn } =
    parsed.data;

  // Fail fast on an obviously bad code before creating an account with it.
  // The actual claim happens atomically after signup, via a Postgres
  // function — this is just an early, friendlier error message.
  if (mode === "access_code" && accessCode) {
    const admin = createAdminClient();
    const { data: codeRow } = await admin
      .from("access_codes")
      .select("is_active, expires_at, max_redemptions, redemption_count")
      .eq("code", accessCode)
      .maybeSingle();

    const isValid =
      !!codeRow &&
      codeRow.is_active &&
      (!codeRow.expires_at || new Date(codeRow.expires_at) > new Date()) &&
      (codeRow.max_redemptions === null || codeRow.redemption_count < codeRow.max_redemptions);

    if (!isValid) {
      return { error: "That access code is invalid or has already been used." };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        date_of_birth: dateOfBirth,
        newsletter_opt_in: newsletterOptIn,
      },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/signup/verified`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (mode === "access_code" && accessCode && data.user) {
    const admin = createAdminClient();
    // A null return here means the code was exhausted by someone else in
    // the gap between the check above and now — rare, and not worth
    // failing an otherwise-successful signup over. When the code carries
    // a granted_plan_id, this also assigns the user's subscription to
    // that plan server-side (migration 0019) — the client never
    // specifies which plan a code grants, only which code it entered.
    await admin.rpc("redeem_access_code", {
      p_code: accessCode,
      p_user_id: data.user.id,
    });
  }

  redirect(`/signup/check-email?email=${encodeURIComponent(email)}`);
}

export async function requestPasswordReset(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  if (!(await consumePasswordResetRateLimit())) {
    return { error: AUTH_RATE_LIMIT_MESSAGE };
  }

  const parsed = requestPasswordResetSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/forgot-password/check-email");
}

export async function updatePassword(
  _prevState: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Requires the temporary session established by verifying the recovery
  // link in /auth/confirm — not a standalone "change my password" form.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: error.message };
  }

  // Role-aware, not a hardcoded /dashboard — any role can go through
  // password recovery, and an admin/institution_admin finishing it
  // belongs on their own home, same as a fresh sign-in.
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();

  revalidatePath("/", "layout");
  redirect(getRoleHomePath(profile?.role));
}

export type ResendResult = { error: string } | { sent: true };

export async function resendSignupConfirmation(
  _prevState: ResendResult | undefined,
  formData: FormData,
): Promise<ResendResult> {
  if (!(await consumeResendConfirmationRateLimit())) {
    return { error: AUTH_RATE_LIMIT_MESSAGE };
  }

  const parsed = resendSignupConfirmationSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/signup/verified`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { sent: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
