import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getQuestionPackById, listActiveQuestions } from "@/lib/test-prep/queries";
import { PracticeEngine } from "@/components/test-prep/practice-engine";

export const dynamic = "force-dynamic";

export default async function PracticePage({ params }: { params: Promise<{ packId: string }> }) {
  await requireUser();
  const { packId } = await params;

  const pack = await getQuestionPackById(packId);
  if (!pack) notFound();

  const questions = await listActiveQuestions(packId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PracticeEngine pack={pack} questions={questions} />
    </div>
  );
}
