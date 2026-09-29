import { DeadlineAdminList } from "@/components/admin/deadline-admin-list";
import { listAllGraduateSchemesForAdmin } from "@/lib/graduate-schemes/queries";

export const dynamic = "force-dynamic";

export default async function AdminDeadlinesPage() {
  const schemes = await listAllGraduateSchemesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <DeadlineAdminList schemes={schemes} />
    </div>
  );
}
