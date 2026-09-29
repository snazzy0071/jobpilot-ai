import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/admin/question-form";
import { getQuestionById, listSubtypes } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function EditQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = await getQuestionById(id);
  if (!question) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <QuestionForm questionPackId={question.questionPackId} question={question} subtypeSuggestions={await listSubtypes()} />
    </div>
  );
}
