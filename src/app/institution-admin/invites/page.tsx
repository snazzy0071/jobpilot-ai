import { requireInstitutionAdmin } from "@/lib/auth/session";
import { listInstitutionInvites } from "@/lib/institutions/admin/queries";
import { InvitesPanel } from "@/components/institution-admin/invites-panel";

export const dynamic = "force-dynamic";

export default async function InstitutionAdminInvitesPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const invites = await listInstitutionInvites(institutionId);

  return (
    <div className="flex flex-col gap-6">
      <InvitesPanel invites={invites} />
    </div>
  );
}
