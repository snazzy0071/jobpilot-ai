import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideAdminList } from "@/components/admin/advice/guide-admin-list";
import { listAllGuidesForAdmin } from "@/lib/advice/queries";

export const dynamic = "force-dynamic";

export default async function AdminAdviceHubPage() {
  const guides = await listAllGuidesForAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button render={<Link href="/admin/advice-hub/new">New guide</Link>}>
          <PlusIcon /> New guide
        </Button>
      </div>
      <GuideAdminList guides={guides} />
    </div>
  );
}
