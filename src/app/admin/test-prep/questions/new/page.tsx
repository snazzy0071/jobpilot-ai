import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/admin/question-form";
import { getQuestionPackById } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function NewQuestionPage({ searchParams }: { searchParams: Promise<{ packId?: string }> }) {
  const { packId } = await searchParams;
  if (!packId) notFound();

  const pack = await getQuestionPackById(packId);
  if (!pack) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Add question</h1>
        <p className="mt-1 text-muted-foreground">In {pack.name}.</p>
      </div>

      <QuestionForm questionPackId={pack.id} />
    </div>
  );
}
