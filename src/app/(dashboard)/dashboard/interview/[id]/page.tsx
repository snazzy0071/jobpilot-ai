import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/entitlements/service";
import { getInterviewSessionDetail } from "@/lib/interviews/queries";
import { Button } from "@/components/ui/button";
import { InterviewChat } from "@/components/interviews/interview-chat";

export const dynamic = "force-dynamic";

const TOPUP_NOTICES: Record<string, string> = {
  success: "Thanks! Your extra voice interviews have been added to this month's allowance — try Begin interview again.",
  canceled: "Checkout was canceled — no charge was made.",
};

/**
 * The live interview session page — a real, working AI interview either
 * way: Claude conducts it one question at a time, with contextual
 * follow-ups, until 5-8 questions have been covered (InterviewChat ->
 * src/lib/interviews/chat-actions.ts). Chat mode types answers directly;
 * voice mode records them (browser MediaRecorder -> server-side
 * transcription -> the same AI turn logic -> British-voice TTS read back
 * aloud) — see InterviewChat's own doc comment for the full flow.
 */
export default async function InterviewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ topup?: string }>;
}) {
  const { id } = await params;
  const { topup } = await searchParams;
  const user = await requireUser();
  const [session, voiceTopupsAllowed] = await Promise.all([
    getInterviewSessionDetail(user.id, id),
    hasFeature(user.id, "voice_topups_allowed"),
  ]);
  if (!session) notFound();
  const topupNotice = topup ? TOPUP_NOTICES[topup] : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={
          <Link href="/dashboard/interview">
            <ArrowLeftIcon /> All sessions
          </Link>
        }
      />

      {topupNotice && <p className="rounded-lg border bg-muted/50 p-3 text-sm">{topupNotice}</p>}

      <InterviewChat
        sessionId={session.id}
        mode={session.mode}
        initialTranscript={session.transcript}
        initialStatus={session.status}
        initialScores={session.scores}
        voiceTopupsAllowed={voiceTopupsAllowed}
      />
    </div>
  );
}
