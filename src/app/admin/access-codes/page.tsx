import { listAccessCodes, listInstitutionOptions, listPlanOptions } from "@/lib/admin/access-codes/queries";
import { AccessCodeForm } from "@/components/admin/access-codes/access-code-form";
import { AccessCodeList } from "@/components/admin/access-codes/access-code-list";

export const dynamic = "force-dynamic";

export default async function AdminAccessCodesPage() {
  const [codes, institutions, plans] = await Promise.all([listAccessCodes(), listInstitutionOptions(), listPlanOptions()]);

  return (
    <div className="flex flex-col gap-8">
      <AccessCodeForm institutions={institutions} plans={plans} />
      <AccessCodeList codes={codes} />
    </div>
  );
}
