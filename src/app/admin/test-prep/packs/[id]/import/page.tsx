import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionImportForm } from "@/components/admin/question-import-form";
import { getQuestionPackById } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function ImportQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pack = await getQuestionPackById(id);
  if (!pack) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <Link href={`/admin/test-prep/packs/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← {pack.name}
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Import questions</h1>
        <p className="mt-1 text-muted-foreground">Add several questions to {pack.name} at once.</p>
      </div>
      <QuestionImportForm questionPackId={id} />
    </div>
  );
}
