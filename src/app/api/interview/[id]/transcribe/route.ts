import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/ai/rate-limit";
import { transcribeAudio, VoiceServiceError } from "@/lib/voice/transcription";
import { validateAudioUpload } from "@/lib/voice/validate-audio-upload";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const dynamic = "force-dynamic";
// Room for a slow Whisper STT round-trip on a large-ish upload without
// eating into the platform's 300s default budget.
export const maxDuration = 30;

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // Whisper's own upload limit.

/**
 * Speech-to-text for one candidate turn in a voice-mode interview — the
 * browser records with MediaRecorder, uploads the resulting blob here,
 * and gets back plain text to review before it's sent through the
 * existing submitInterviewAnswer Server Action (src/lib/interviews/
 * chat-actions.ts), unchanged from the chat flow. The audio itself is
 * never persisted — read into memory, transcribed, discarded — same
 * "don't store what you don't need" pattern as /api/files/parse.
 *
 * Not a separate plan-gated feature: the voice_interviews_per_month
 * credit is already spent once, at startInterview, for the whole
 * session — this just turns speech into the text that flow already
 * expects. consumeRateLimit is reused here purely for abuse/burst
 * protection (a user could otherwise fire unlimited transcription
 * requests against their own already-paid-for session).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id: sessionId } = await params;
  const user = await requireUser();

  const rateLimit = await consumeRateLimit(user.id, "interview_voice_transcribe");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "You're sending requests too quickly — wait a moment and try again." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("id, mode, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "That interview couldn't be found." }, { status: 404 });
  if (session.mode !== "voice") return NextResponse.json({ error: "This session isn't a voice interview." }, { status: 400 });
  if (session.status !== "in_progress") return NextResponse.json({ error: "This interview has already ended." }, { status: 400 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Couldn't read that recording — try again." }, { status: 400 });
  }

  const file = formData.get("audio");
  if (!(file instanceof File)) return NextResponse.json({ error: "No recording was uploaded." }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "That recording is empty — try again." }, { status: 400 });
  if (file.size > MAX_AUDIO_SIZE_BYTES) {
    return NextResponse.json({ error: "That recording is too long — try answering in shorter takes." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Declared type (client-supplied, spoofable) is never trusted on its
  // own — same "sniff the real bytes" principle /api/files/parse's
  // parseDocument already applies to CV uploads, closing the same gap
  // here: nothing previously checked this upload's real format at all.
  const validated = validateAudioUpload(buffer, file.type || "audio/webm");
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const text = await transcribeAudio(buffer, file.type || "audio/webm", file.name || "recording.webm");
    if (!text.trim()) {
      return NextResponse.json({ error: "Couldn't make out any speech in that recording — try again." }, { status: 422 });
    }
    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    const message = err instanceof VoiceServiceError ? err.message : "Couldn't transcribe that recording — try again.";
    console.error(`Interview transcription failed for session ${sessionId}:`, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
