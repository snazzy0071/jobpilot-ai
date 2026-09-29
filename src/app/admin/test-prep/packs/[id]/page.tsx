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
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href={`/admin/test-prep/packs/${id}/import`}>Import JSON</Link>} />
          <Button render={<Link href={`/admin/test-prep/questions/new?packId=${id}`} />}>
            <Plus className="size-4" /> Add question
          </Button>
        </div>
      </div>

      <QuestionAdminList questions={questions} />
    </div>
  );
}
