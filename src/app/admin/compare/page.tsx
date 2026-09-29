import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonAdminList } from "@/components/admin/comparisons/comparison-admin-list";
import { listAllComparisonsForAdmin } from "@/lib/comparisons/queries";

export const dynamic = "force-dynamic";

export default async function AdminComparisonsPage() {
  const pages = await listAllComparisonsForAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button render={<Link href="/admin/compare/new">New comparison</Link>}>
          <PlusIcon /> New comparison
        </Button>
      </div>
      <ComparisonAdminList pages={pages} />
    </div>
  );
}
