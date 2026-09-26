import { requireUser } from "@/lib/auth/session";
import { DailyPracticeEngine } from "@/components/test-prep/daily-practice-engine";
import { LockedTestPrep } from "@/components/test-prep/locked-test-prep";
import { hasTestPrepAccess } from "@/lib/test-prep/access";
import { getPackQuestionCounts, listActiveTestTypes } from "@/lib/test-prep/queries";

export const dynamic = "force-dynamic";

export default async function DailyPracticePage() {
  const user = await requireUser();

  if (!(await hasTestPrepAccess(user.id))) {
    const [types, counts] = await Promise.all([listActiveTestTypes(), getPackQuestionCounts()]);
    return <LockedTestPrep typeCount={types.length} questionCount={[...counts.values()].reduce((sum, count) => sum + count, 0)} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <DailyPracticeEngine />
    </div>
  );
}
