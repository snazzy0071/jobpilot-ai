import { notFound } from "next/navigation";
import { QuestionPackForm } from "@/components/admin/question-pack-form";
import { getQuestionPackById } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function EditQuestionPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pack = await getQuestionPackById(id);
  if (!pack) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit pack</h1>
        <p className="mt-1 text-muted-foreground">{pack.name}</p>
      </div>

      <QuestionPackForm testTypeId={pack.testTypeId} pack={pack} />
    </div>
  );
}
