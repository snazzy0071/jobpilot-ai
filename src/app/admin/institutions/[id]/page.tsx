import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminInstitutionDetail, listPlanOptions } from "@/lib/admin/institutions/queries";
import { LicencePanel } from "@/components/admin/institutions/licence-panel";
import { DomainsAdminPanel } from "@/components/admin/institutions/domains-admin-panel";
import { AddAdminForm } from "@/components/admin/institutions/add-admin-form";

export const dynamic = "force-dynamic";

export default async function AdminInstitutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [institution, plans] = await Promise.all([getAdminInstitutionDetail(id), listPlanOptions()]);
  if (!institution) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/institutions"><ArrowLeftIcon /> Institutions</Link>} />

      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{institution.name}</h1>
        <p className="mt-1 text-muted-foreground">{institution.slug}</p>
      </div>

      <LicencePanel institutionId={institution.id} licence={institution.licence} plans={plans} seatsUsed={institution.seatsUsed} />
      <DomainsAdminPanel domains={institution.domains} />
      <AddAdminForm institutionId={institution.id} admins={institution.admins} />
    </div>
  );
}
