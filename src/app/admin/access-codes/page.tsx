import { listAccessCodes, listInstitutionOptions, listPlanOptions } from "@/lib/admin/access-codes/queries";
import { AccessCodeForm } from "@/components/admin/access-codes/access-code-form";
import { AccessCodeList } from "@/components/admin/access-codes/access-code-list";

export const dynamic = "force-dynamic";

export default async function AdminAccessCodesPage() {
  const [codes, institutions, plans] = await Promise.all([listAccessCodes(), listInstitutionOptions(), listPlanOptions()]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Access codes</h1>
        <p className="mt-1 text-muted-foreground">Free-access codes for institutions and promotions — redemption itself always goes through redeem_access_code(), never a direct write.</p>
      </div>

      <AccessCodeForm institutions={institutions} plans={plans} />
      <AccessCodeList codes={codes} />
    </div>
  );
}
