import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { FocusPracticeStart } from "@/components/test-prep/focus-practice-start";
import { LockedTestPrep } from "@/components/test-prep/locked-test-prep";
import { hasTestPrepAccess } from "@/lib/test-prep/access";
import { getPackQuestionCounts, listActiveTestTypes } from "@/lib/test-prep/queries";

export const dynamic = "force-dynamic";

/** Focused practice on one topic — where the weak-area recommendations and the progress page's "Practise" buttons lead. */
export default async function FocusPracticePage({ searchParams }: { searchParams: Promise<{ type?: string; subtype?: string }> }) {
  const user = await requireUser();
  const { type, subtype } = await searchParams;

  const testTypes = await listActiveTestTypes();
  if (!(await hasTestPrepAccess(user.id))) {
    const counts = await getPackQuestionCounts();
    return <LockedTestPrep typeCount={testTypes.length} questionCount={[...counts.values()].reduce((sum, count) => sum + count, 0)} />;
  }

  const testType = testTypes.find((candidate) => candidate.id === type);
  if (!testType || !subtype || subtype.length > 100) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <FocusPracticeStart testTypeId={testType.id} testTypeName={testType.name} subtype={subtype} />
    </div>
  );
}
