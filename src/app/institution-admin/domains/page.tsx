import { requireInstitutionAdmin } from "@/lib/auth/session";
import { listInstitutionDomains } from "@/lib/institutions/admin/queries";
import { DomainsPanel } from "@/components/institution-admin/domains-panel";

export const dynamic = "force-dynamic";

export default async function InstitutionAdminDomainsPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const domains = await listInstitutionDomains(institutionId);

  return (
    <div className="flex flex-col gap-6">
      <DomainsPanel domains={domains} />
    </div>
  );
}
