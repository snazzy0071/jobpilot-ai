import { requireInstitutionAdmin } from "@/lib/auth/session";
import { listInstitutionDomains } from "@/lib/institutions/admin/queries";
import { DomainsPanel } from "@/components/institution-admin/domains-panel";

export const dynamic = "force-dynamic";

export default async function InstitutionAdminDomainsPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const domains = await listInstitutionDomains(institutionId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Email domains</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Claim the email domains your students use. After JobPilot verifies a domain, anyone who confirms an address at it joins your institution automatically, using a seat, for as long as your licence is in force. Until then a claim does nothing.
        </p>
      </div>
      <DomainsPanel domains={domains} />
    </div>
  );
}
