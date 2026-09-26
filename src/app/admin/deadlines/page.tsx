import { DeadlineAdminList } from "@/components/admin/deadline-admin-list";
import { listAllGraduateSchemesForAdmin } from "@/lib/graduate-schemes/queries";
import { isStale } from "@/lib/graduate-schemes/staleness";

export const dynamic = "force-dynamic";

export default async function AdminDeadlinesPage() {
  const schemes = await listAllGraduateSchemesForAdmin();
  const stale = schemes.filter((scheme) => isStale(scheme.verifiedAt)).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Scheme deadlines</h1>
        <p className="mt-1 text-muted-foreground">
          {schemes.length} scheme{schemes.length === 1 ? "" : "s"}
          {stale > 0 ? ` · ${stale} not verified recently` : ""}. Oldest checks first. Verify a scheme only after re-checking its source; correct a date together with where it came from.
        </p>
      </div>
      <DeadlineAdminList schemes={schemes} />
    </div>
  );
}
