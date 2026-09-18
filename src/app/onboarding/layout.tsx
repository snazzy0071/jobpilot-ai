import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getCurrentInstitutionBranding } from "@/lib/institutions/queries";
import { Logo } from "@/components/layout/logo";
import { InstitutionCobrandBanner } from "@/components/onboarding/institution-cobrand-banner";
import { SkipLink } from "@/components/layout/skip-link";

// See src/app/(dashboard)/layout.tsx's own comment on why this is set
// explicitly rather than relying on robots.txt's disallow alone.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const institution = await getCurrentInstitutionBranding(user.id);

  return (
    <>
      <SkipLink />
      <main id="main-content" className="flex min-h-screen flex-1 flex-col items-center gap-8 px-4 py-16">
        <Logo />
        {institution && <InstitutionCobrandBanner institution={institution} />}
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </>
  );
}
