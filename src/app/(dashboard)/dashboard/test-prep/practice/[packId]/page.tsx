import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { LockedTestPrep } from "@/components/test-prep/locked-test-prep";
import { PackStart } from "@/components/test-prep/pack-start";
import { hasTestPrepAccess } from "@/lib/test-prep/access";
import { getPackQuestionCounts, getQuestionPackById, listActiveTestTypes } from "@/lib/test-prep/queries";

export const dynamic = "force-dynamic";

export default async function PracticePage({ params }: { params: Promise<{ packId: string }> }) {
  const user = await requireUser();
  const { packId } = await params;

  if (!(await hasTestPrepAccess(user.id))) {
    const [types, counts] = await Promise.all([listActiveTestTypes(), getPackQuestionCounts()]);
    return <LockedTestPrep typeCount={types.length} questionCount={[...counts.values()].reduce((sum, count) => sum + count, 0)} />;
  }

  const pack = await getQuestionPackById(packId);
  if (!pack) notFound();
  const counts = await getPackQuestionCounts();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PackStart pack={pack} questionCount={counts.get(pack.id) ?? 0} />
    </div>
  );
}
