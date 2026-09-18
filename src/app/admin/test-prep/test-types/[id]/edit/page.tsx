import { notFound } from "next/navigation";
import { TestTypeForm } from "@/components/admin/test-type-form";
import { getTestTypeById } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function EditTestTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const testType = await getTestTypeById(id);
  if (!testType) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit test type</h1>
        <p className="mt-1 text-muted-foreground">{testType.name}</p>
      </div>

      <TestTypeForm testType={testType} />
    </div>
  );
}
