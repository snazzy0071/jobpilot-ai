import type { Metadata } from "next";
import { requireUser, getImpersonationStatus, getEffectiveProfile, getEffectiveUser } from "@/lib/auth/session";
import { getCurrentInstitutionBranding } from "@/lib/institutions/queries";
import { Logo } from "@/components/layout/logo";
import { InstitutionCobrandBanner } from "@/components/onboarding/institution-cobrand-banner";
import { SkipLink } from "@/components/layout/skip-link";
import { SchemeSignupContext } from "@/components/graduate-schemes/scheme-signup-context";
import { getPendingScheme } from "@/lib/graduate-schemes/signup-server";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";

// See src/app/(dashboard)/layout.tsx's own comment on why this is set
// explicitly rather than relying on robots.txt's disallow alone.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  // Deliberately the REAL user, not the impersonation target — see this
  // file's own long-standing reasoning below (onboarding always runs as
  // whoever is really signed in). The banner alone uses the effective
  // identity, purely for its own label; every onboarding form on these
  // pages is still blocked from writing anything during impersonation
  // by proxy.ts, same as every other dashboard-area mutation.
  const user = await requireUser();
  const institution = await getCurrentInstitutionBranding(user.id);
  // Signed up for a specific graduate scheme: keep it in view, since finishing onboarding takes them straight into its preparation.
  const scheme = await getPendingScheme(user);
  const impersonation = await getImpersonationStatus();
  const effectiveProfile = impersonation ? await getEffectiveProfile() : null;
  const effectiveUser = impersonation ? await getEffectiveUser() : null;

  return (
    <>
      <SkipLink />
      {impersonation && (
        <ImpersonationBanner targetLabel={effectiveProfile?.full_name ?? effectiveUser?.email ?? "this user"} />
      )}
      <main id="main-content" className="flex min-h-screen flex-1 flex-col items-center gap-8 px-4 py-16">
        <Logo />
        {institution && <InstitutionCobrandBanner institution={institution} />}
        {scheme && (
          <div className="w-full max-w-lg">
            <SchemeSignupContext scheme={scheme} heading="After this, you'll prepare for" />
          </div>
        )}
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </>
  );
}
