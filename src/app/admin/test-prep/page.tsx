import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TestTypeAdminList } from "@/components/admin/test-type-admin-list";
import { listTestTypes, listQuestionPacks } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminTestPrepPage() {
  const testTypes = await listTestTypes();
  const packCountEntries = await Promise.all(
    testTypes.map(async (testType) => [testType.id, (await listQuestionPacks(testType.id)).length] as const),
  );
  const packCounts = Object.fromEntries(packCountEntries);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Button render={<Link href="/admin/test-prep/test-types/new" />}>
          <Plus className="size-4" /> Add test type
        </Button>
      </div>

      <TestTypeAdminList testTypes={testTypes} packCounts={packCounts} />
    </div>
  );
}
