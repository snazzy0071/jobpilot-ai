import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/admin/question-form";
import { getQuestionById } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = await getQuestionById(id);
  if (!question) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit question</h1>
      </div>

      <QuestionForm questionPackId={question.questionPackId} question={question} />
    </div>
  );
}
