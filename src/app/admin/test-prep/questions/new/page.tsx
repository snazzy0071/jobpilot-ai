import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/admin/question-form";
import { getQuestionPackById, listSubtypes } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ packId?: string }> }) {
  const { packId } = await searchParams;
  if (!packId) notFound();

  const pack = await getQuestionPackById(packId);
  if (!pack) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <QuestionForm questionPackId={pack.id} subtypeSuggestions={await listSubtypes()} />
    </div>
  );
}
