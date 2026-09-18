import { requireUser } from "@/lib/auth/session";
import { DailyPracticeEngine } from "@/components/test-prep/daily-practice-engine";

export const dynamic = "force-dynamic";

export default async function DailyPracticePage() {
  await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <DailyPracticeEngine />
    </div>
  );
}
