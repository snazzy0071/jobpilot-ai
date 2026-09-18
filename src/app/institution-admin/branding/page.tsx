import { requireInstitutionAdmin } from "@/lib/auth/session";
import { getInstitutionOverview } from "@/lib/institutions/admin/queries";
import { BrandingForm } from "@/components/institution-admin/branding-form";

export const dynamic = "force-dynamic";

export default async function InstitutionAdminBrandingPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const overview = await getInstitutionOverview(institutionId);

  if (!overview) {
    return <p className="text-muted-foreground">Your institution couldn&apos;t be found.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="mt-1 text-muted-foreground">Co-brand your students&apos; onboarding — this never affects JobPilot&apos;s own theme for anyone else.</p>
      </div>
      <BrandingForm institution={overview.institution} />
    </div>
  );
}
