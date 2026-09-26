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
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Advice Hub</h1>
          <p className="mt-1 text-muted-foreground">
            {guides.length} guide{guides.length === 1 ? "" : "s"} across eight categories. Separate from the Blog.
          </p>
        </div>
        <Button render={<Link href="/admin/advice-hub/new">New guide</Link>}>
          <PlusIcon /> New guide
        </Button>
      </div>
      <GuideAdminList guides={guides} />
    </div>
  );
}
