import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionPackAdminList } from "@/components/admin/question-pack-admin-list";
import { getTestTypeById, listQuestionPacks, listQuestions } from "@/lib/test-prep/admin/queries";

export const dynamic = "force-dynamic";

export default async function TestTypePacksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const testType = await getTestTypeById(id);
  if (!testType) notFound();

  const packs = await listQuestionPacks(id);
  const questionCountEntries = await Promise.all(packs.map(async (pack) => [pack.id, (await listQuestions(pack.id)).length] as const));
  const questionCounts = Object.fromEntries(questionCountEntries);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/test-prep" className="text-sm text-muted-foreground hover:underline">
            ← Test Prep
          </Link>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{testType.name}</h1>
          <p className="mt-1 text-muted-foreground">{testType.description ?? "Question packs under this test type."}</p>
        </div>
        <Button render={<Link href={`/admin/test-prep/packs/new?testTypeId=${id}`} />}>
          <Plus className="size-4" /> Add pack
        </Button>
      </div>

      <QuestionPackAdminList packs={packs} questionCounts={questionCounts} />
    </div>
  );
}
