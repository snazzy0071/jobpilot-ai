import { requireInstitutionAdmin } from "@/lib/auth/session";
import { listInstitutionMembers } from "@/lib/institutions/admin/queries";
import { MembersTable } from "@/components/institution-admin/members-table";

export const dynamic = "force-dynamic";

export default async function InstitutionAdminMembersPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const members = await listInstitutionMembers(institutionId);

  return (
    <div className="flex flex-col gap-6">
      <MembersTable members={members} />
    </div>
  );
}
