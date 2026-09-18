import { requireInstitutionAdmin } from "@/lib/auth/session";
import { listInstitutionInvites } from "@/lib/institutions/admin/queries";
import { InvitesPanel } from "@/components/institution-admin/invites-panel";

export const dynamic = "force-dynamic";

export default async function InstitutionAdminInvitesPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const invites = await listInstitutionInvites(institutionId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Invites</h1>
        <p className="mt-1 text-muted-foreground">Invite students or staff by email — each invite reserves a seat until it&apos;s accepted or revoked.</p>
      </div>
      <InvitesPanel invites={invites} />
    </div>
  );
}
