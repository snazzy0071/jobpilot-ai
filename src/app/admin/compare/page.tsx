import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonAdminList } from "@/components/admin/comparisons/comparison-admin-list";
import { listAllComparisonsForAdmin } from "@/lib/comparisons/queries";
import { isStale } from "@/lib/graduate-schemes/staleness";

export const dynamic = "force-dynamic";

export default async function AdminComparisonsPage() {
  const pages = await listAllComparisonsForAdmin();
  const stale = pages.filter((page) => isStale(page.updatedOn)).length;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Comparison pages</h1>
          <p className="mt-1 text-muted-foreground">
            {pages.length} comparison{pages.length === 1 ? "" : "s"}
            {stale > 0 ? ` · ${stale} need${stale === 1 ? "s" : ""} rechecking` : ""}. Every claim about a competitor needs a source and a date.
          </p>
        </div>
        <Button render={<Link href="/admin/compare/new">New comparison</Link>}>
          <PlusIcon /> New comparison
        </Button>
      </div>
      <ComparisonAdminList pages={pages} />
    </div>
  );
}
