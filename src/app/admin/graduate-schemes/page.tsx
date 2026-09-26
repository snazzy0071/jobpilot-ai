import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GraduateSchemeAdminList } from "@/components/admin/graduate-scheme-admin-list";
import { listAllGraduateSchemesForAdmin } from "@/lib/graduate-schemes/queries";
import { isStale } from "@/lib/graduate-schemes/staleness";

export const dynamic = "force-dynamic";

export default async function AdminGraduateSchemesPage() {
  const schemes = await listAllGraduateSchemesForAdmin();
  const staleCount = schemes.filter((scheme) => isStale(scheme.verifiedAt)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Graduate Schemes</h1>
          <p className="mt-1 text-muted-foreground">
            {schemes.length} scheme{schemes.length === 1 ? "" : "s"}
            {staleCount > 0 ? ` · ${staleCount} need${staleCount === 1 ? "s" : ""} review` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/admin/graduate-schemes/assessments/import" />}>
            <Upload className="size-4" /> Import assessments
          </Button>
          <Button variant="outline" render={<Link href="/admin/graduate-schemes/import" />}>
            <Upload className="size-4" /> Import CSV
          </Button>
          <Button render={<Link href="/admin/graduate-schemes/new" />}>
            <Plus className="size-4" /> Add scheme
          </Button>
        </div>
      </div>

      <GraduateSchemeAdminList schemes={schemes} />
    </div>
  );
}
