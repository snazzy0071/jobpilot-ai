import { requireInstitutionAdmin } from "@/lib/auth/session";
import { listInstitutionMembers } from "@/lib/institutions/admin/queries";
import { MembersTable } from "@/components/institution-admin/members-table";

export const dynamic = "force-dynamic";

export default async function InstitutionAdminMembersPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const members = await listInstitutionMembers(institutionId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Students &amp; members</h1>
        <p className="mt-1 text-muted-foreground">Everyone in your institution&apos;s cohort — {members.length} total.</p>
      </div>
      <MembersTable members={members} />
    </div>
  );
}
