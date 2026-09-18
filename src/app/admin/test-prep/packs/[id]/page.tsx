import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionAdminList } from "@/components/admin/question-admin-list";
import { getQuestionPackById, listQuestions } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function QuestionPackQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pack = await getQuestionPackById(id);
  if (!pack) notFound();

  const questions = await listQuestions(id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/admin/test-prep/test-types/${pack.testTypeId}`} className="text-sm text-muted-foreground hover:underline">
            ← Back
          </Link>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{pack.name}</h1>
          <p className="mt-1 text-muted-foreground">{pack.description ?? "Questions in this pack."}</p>
        </div>
        <Button render={<Link href={`/admin/test-prep/questions/new?packId=${id}`} />}>
          <Plus className="size-4" /> Add question
        </Button>
      </div>

      <QuestionAdminList questions={questions} />
    </div>
  );
}
