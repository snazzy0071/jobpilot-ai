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
      <BrandingForm institution={overview.institution} />
    </div>
  );
}
