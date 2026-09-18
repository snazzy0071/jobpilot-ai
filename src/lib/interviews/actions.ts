"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCvEditorData } from "@/lib/cvs/queries";
import { buildCvPlainText } from "@/lib/cvs/ats-format-checks";
import { createInterviewSessionSchema } from "@/lib/interviews/schemas";

export type CreateInterviewSessionResult = { error: string } | { sessionId: string };

/**
 * The interview setup flow: company, role, an optional job description,
 * interview type (chat/voice — src/lib/interviews/types.ts's
 * InterviewMode), difficulty, and which CV to ground questions in.
 *
 * Deliberately does *not* call the AI or consume any
 * chat_interviews_per_month/voice_interviews_per_month allowance here —
 * a session is now a live, turn-by-turn conversation
 * (src/lib/interviews/chat-actions.ts), not a pre-generated batch of
 * questions, so there's nothing to generate yet at setup time. The one
 * `chat_interviews_per_month`/`voice_interviews_per_month` credit this
 * session will cost is spent when the conversation actually begins
 * (`startInterview`), not merely for filling in this form — same
 * "respect plan/mode limits" requirement, just enforced at the point
 * where an AI call actually happens rather than here, where none does.
 *
 * CV grounding is still resolved and snapshotted here, though — the
 * source CV a session is grounded in shouldn't silently change if the
 * user keeps editing that CV while this interview is still in progress.
 */
export async function createInterviewSession(formData: FormData): Promise<CreateInterviewSessionResult> {
  const user = await requireUser();

  const parsed = createInterviewSessionSchema.safeParse({
    cvId: formData.get("cvId"),
    company: formData.get("company"),
    role: formData.get("role"),
    jobDescription: formData.get("jobDescription") || undefined,
    mode: formData.get("mode"),
    difficulty: formData.get("difficulty"),
    focusCompetencies: formData.get("focusCompetencies") || undefined,
    practicedFromSessionId: formData.get("practicedFromSessionId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const cv = await getCvEditorData(user.id, parsed.data.cvId);
  if (!cv) return { error: "That CV couldn't be found." };

  const cvText = buildCvPlainText(cv);
  if (!cvText.trim()) return { error: "That CV has no content yet — add some before starting a mock interview." };

  const supabase = await createClient();

  // Not trusted just because it parsed as a uuid — confirm this user
  // really owns the session they're claiming to be re-practicing before
  // linking to it, the same ownership discipline every other write path
  // in this app applies to any client-supplied foreign id.
  if (parsed.data.practicedFromSessionId) {
    const { data: sourceSession } = await supabase
      .from("interview_sessions")
      .select("id")
      .eq("id", parsed.data.practicedFromSessionId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!sourceSession) return { error: "That interview couldn't be found." };
  }

  const { data: sessionRow, error: sessionError } = await supabase
    .from("interview_sessions")
    .insert({
      user_id: user.id,
      role: parsed.data.role,
      company: parsed.data.company,
      mode: parsed.data.mode,
      difficulty: parsed.data.difficulty,
      job_description: parsed.data.jobDescription ?? null,
      cv_version_id: cv.versionId,
      cv_text_snapshot: cvText,
      focus_competencies: parsed.data.focusCompetencies ?? [],
      practiced_from_session_id: parsed.data.practicedFromSessionId ?? null,
    })
    .select("id")
    .single();
  if (sessionError || !sessionRow) return { error: "Couldn't set up that interview — try again." };

  revalidatePath("/dashboard/interview");
  return { sessionId: sessionRow.id };
}
