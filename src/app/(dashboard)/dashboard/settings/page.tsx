import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SettingsPanel, SettingsTab, SettingsTabs, SettingsTabsList } from "@/components/settings/settings-tabs";
import { ProfileForm } from "@/components/settings/profile-form";
import { CareerPreferencesForm } from "@/components/settings/career-preferences-form";
import { AccountEmailForm } from "@/components/settings/account-email-form";
import { AccountPasswordForm } from "@/components/settings/account-password-form";
import { ConnectedProvidersPanel } from "@/components/settings/connected-providers-panel";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { BillingPanel } from "@/components/settings/billing-panel";
import { InstitutionEnrollmentPanel } from "@/components/settings/institution-enrollment-panel";
import { getCurrentSubscription } from "@/lib/billing/queries";
import { checkUsageAllowed, hasFeature } from "@/lib/entitlements/service";
import { getCurrentInstitutionMembership } from "@/lib/institutions/queries";

const TABS = ["profile", "career", "account", "notifications", "privacy", "billing", "institution"] as const;

const BILLING_NOTICES: Record<string, string> = {
  success: "You're subscribed — thanks!",
  canceled: "Checkout was canceled — no charge was made.",
  updated: "Your plan has been updated.",
  canceling: "Your subscription will end at the end of the current period.",
  reactivated: "Your subscription has been reactivated.",
};

const TOPUP_NOTICES: Record<string, string> = {
  success: "Thanks! Your extra voice interviews have been added to this month's allowance.",
  canceled: "Checkout was canceled — no charge was made.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; checkout?: string; plan?: string; topup?: string }>;
}) {
  const user = await requireUser();
  const { tab, checkout, plan: planNotice, topup } = await searchParams;
  const initialTab = TABS.includes(tab as (typeof TABS)[number]) ? tab! : "profile";
  const billingNotice =
    BILLING_NOTICES[checkout ?? ""] ?? BILLING_NOTICES[planNotice ?? ""] ?? TOPUP_NOTICES[topup ?? ""] ?? null;

  const supabase = await createClient();
  const [
    { data: profile },
    { data: preferences },
    { data: identitiesData },
    currentSubscription,
    voiceUsage,
    voiceTopupsAllowed,
    institutionMembership,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_preferences").select("*").eq("id", user.id).single(),
    supabase.auth.getUserIdentities(),
    getCurrentSubscription(user.id),
    checkUsageAllowed(user.id, "voice_interviews_per_month"),
    hasFeature(user.id, "voice_topups_allowed"),
    getCurrentInstitutionMembership(user.id),
  ]);
  const allIdentities = identitiesData?.identities ?? [];
  const oauthIdentities = allIdentities.filter((identity) => identity.provider !== "email");

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Settings</h1>

      <SettingsTabs defaultValue={initialTab} className="mt-6">
        <SettingsTabsList>
          <SettingsTab value="profile">Profile</SettingsTab>
          <SettingsTab value="career">Career Preferences</SettingsTab>
          <SettingsTab value="account">Account</SettingsTab>
          <SettingsTab value="notifications">Notifications</SettingsTab>
          <SettingsTab value="privacy">Privacy</SettingsTab>
          <SettingsTab value="billing">Billing</SettingsTab>
          <SettingsTab value="institution">Institution</SettingsTab>
        </SettingsTabsList>

        <SettingsPanel value="profile" className="pt-6">
          <ProfileForm
            defaultFullName={profile?.full_name ?? null}
            defaultDateOfBirth={profile?.date_of_birth ?? null}
          />
        </SettingsPanel>

        <SettingsPanel value="career" className="pt-6">
          <CareerPreferencesForm
            defaultCareerStage={preferences?.career_stage ?? null}
            defaultPrimaryGoal={preferences?.primary_goal ?? null}
            defaultTargetRoles={preferences?.target_roles ?? []}
            defaultIndustries={preferences?.industries ?? []}
            defaultLocation={preferences?.location ?? null}
            defaultGraduationYear={preferences?.graduation_year ?? null}
            defaultVisaPreference={preferences?.visa_sponsorship_preference ?? null}
          />
        </SettingsPanel>

        <SettingsPanel value="account" className="flex flex-col gap-8 pt-6">
          <AccountEmailForm currentEmail={user.email ?? null} />
          <AccountPasswordForm />
          <ConnectedProvidersPanel
            identities={oauthIdentities}
            totalIdentityCount={allIdentities.length}
          />
        </SettingsPanel>

        <SettingsPanel value="notifications" className="pt-6">
          <NotificationsForm defaultOptIn={profile?.newsletter_opt_in ?? false} />
        </SettingsPanel>

        <SettingsPanel value="privacy" className="flex flex-col gap-8 pt-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Export your data</p>
            <p className="text-sm text-muted-foreground">
              Download a copy of your profile and tracked applications — every application, status
              change, and reminder you&apos;ve added.
            </p>
            <div className="flex gap-4">
              <a
                href="/dashboard/settings/export"
                className="self-start text-sm font-medium text-foreground underline"
              >
                Export as JSON
              </a>
              <a
                href="/dashboard/settings/export?format=zip"
                className="self-start text-sm font-medium text-foreground underline"
              >
                Export as ZIP
              </a>
            </div>
          </div>
          <DeleteAccountForm />
        </SettingsPanel>

        <SettingsPanel value="billing" className="flex flex-col gap-4 pt-6">
          {billingNotice && (
            <p className="rounded-lg border bg-muted/50 p-3 text-sm">{billingNotice}</p>
          )}
          <BillingPanel
            currentSubscription={currentSubscription}
            fallbackPlan={profile?.plan ?? "free"}
            voiceUsage={voiceUsage}
            voiceTopupsAllowed={voiceTopupsAllowed}
          />
        </SettingsPanel>

        <SettingsPanel value="institution" className="pt-6">
          <InstitutionEnrollmentPanel membership={institutionMembership} />
        </SettingsPanel>
      </SettingsTabs>
    </div>
  );
}
