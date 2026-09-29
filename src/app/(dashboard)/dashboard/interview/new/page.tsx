import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { listCvs } from "@/lib/cvs/queries";
import { checkUsageAllowed, hasFeature } from "@/lib/entitlements/service";
import { getInterviewSessionDetail } from "@/lib/interviews/queries";
import { computeCompetencyBreakdown, getWeakCompetencies } from "@/lib/interviews/results";
import { InterviewSetupForm, type InterviewRepractice } from "@/components/interviews/interview-setup-form";

export const dynamic = "force-dynamic";

const TOPUP_NOTICES: Record<string, string> = {
  success: "Thanks! Your extra voice interviews have been added to this month's allowance.",
  canceled: "Checkout was canceled — no charge was made.",
};

export default async function NewInterviewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ fromSessionId?: string; topup?: string }>;
}) {
  const { fromSessionId, topup } = await searchParams;
  const user = await requireUser();
  const topupNotice = topup ? TOPUP_NOTICES[topup] : null;

  const [cvs, chatAccess, voiceAccess, voiceTopupsAllowed] = await Promise.all([
    listCvs(user.id),
    checkUsageAllowed(user.id, "chat_interviews_per_month"),
    checkUsageAllowed(user.id, "voice_interviews_per_month"),
    hasFeature(user.id, "voice_topups_allowed"),
  ]);

  // "Practice weak areas": the source session is only ever *read* here
  // (ownership-checked the same way every other session read is) to
  // derive pre-fill values — nothing about it is ever written to.
  let repractice: InterviewRepractice | null = null;
  if (fromSessionId) {
    const sourceSession = await getInterviewSessionDetail(user.id, fromSessionId);
    if (!sourceSession) notFound();

    const breakdown = computeCompetencyBreakdown(sourceSession.questions, sourceSession.scores);
    const focusCompetencies = getWeakCompetencies(breakdown);
    repractice = {
      company: sourceSession.company ?? "",
      role: sourceSession.role,
      focusCompetencies,
      fromSessionId: sourceSession.id,
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {topupNotice && <p className="rounded-lg border bg-muted/50 p-3 text-sm">{topupNotice}</p>}

      <InterviewSetupForm
        cvs={cvs}
        modeAccess={{ chat: chatAccess, voice: voiceAccess }}
        voiceTopupsAllowed={voiceTopupsAllowed}
        repractice={repractice}
      />
    </div>
  );
}
