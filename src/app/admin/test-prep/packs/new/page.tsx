import { notFound } from "next/navigation";
import { QuestionPackForm } from "@/components/admin/question-pack-form";
import { getTestTypeById } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function NewQuestionPackPage({ searchParams }: { searchParams: Promise<{ testTypeId?: string }> }) {
  const { testTypeId } = await searchParams;
  if (!testTypeId) notFound();

  const testType = await getTestTypeById(testTypeId);
  if (!testType) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Add pack</h1>
        <p className="mt-1 text-muted-foreground">Under {testType.name}.</p>
      </div>

      <QuestionPackForm testTypeId={testType.id} />
    </div>
  );
}
