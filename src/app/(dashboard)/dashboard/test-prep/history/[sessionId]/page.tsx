import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { LockedTestPrep } from "@/components/test-prep/locked-test-prep";
import { SessionSummary } from "@/components/test-prep/session-summary";
import { hasTestPrepAccess } from "@/lib/test-prep/access";
import { getSessionReview } from "@/lib/test-prep/practice/actions";
import { getPackQuestionCounts, listActiveTestTypes } from "@/lib/test-prep/queries";

export const dynamic = "force-dynamic";

/** A finished session, in full: the same summary you saw when you finished it, with every question, your answer, the answer key and the explanation. Only ever a finished session that belongs to you (an unfinished one keeps its key on the server). */
export default async function SessionReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser();
  const { sessionId } = await params;

  if (!(await hasTestPrepAccess(user.id))) {
    const [types, counts] = await Promise.all([listActiveTestTypes(), getPackQuestionCounts()]);
    return <LockedTestPrep typeCount={types.length} questionCount={[...counts.values()].reduce((sum, count) => sum + count, 0)} />;
  }

  const review = await getSessionReview({ testSessionId: sessionId });
  if ("error" in review) notFound();

  const title = review.meta.isDaily ? "Daily five" : review.meta.focusSubtype ? `Focus: ${review.meta.focusSubtype}` : (review.meta.packName ?? "Practice session");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/dashboard/test-prep/progress"><ArrowLeftIcon /> Progress</Link>} />
      <SessionSummary title={title} mode={review.meta.mode} questions={review.questions} answers={new Map(review.answers.map((answer) => [answer.questionId, answer]))} result={review} />
    </div>
  );
}
