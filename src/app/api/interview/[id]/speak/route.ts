import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/ai/rate-limit";
import { synthesizeSpeech, VoiceServiceError } from "@/lib/voice/speech";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const dynamic = "force-dynamic";
// Room for a slow ElevenLabs TTS round-trip without eating into the
// platform's 300s default budget.
export const maxDuration = 30;

const speakRequestSchema = z.object({ turnId: z.string().uuid() });

/**
 * Text-to-speech for one interviewer turn in a voice-mode interview —
 * reads the turn's own already-generated text back out of
 * interview_transcripts (never trusts client-supplied text directly,
 * so this can't become an arbitrary free-text TTS proxy) and synthesizes
 * it in the operator-configured British voice (ELEVENLABS_VOICE_ID).
 * Only interviewer turns are speakable — the candidate's own words were
 * already spoken by the candidate.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id: sessionId } = await params;
  const user = await requireUser();

  const rateLimit = await consumeRateLimit(user.id, "interview_voice_speak");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "You're sending requests too quickly — wait a moment and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = speakRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  const { data: turn } = await supabase
    .from("interview_transcripts")
    .select("content, speaker")
    .eq("id", parsed.data.turnId)
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!turn || turn.speaker !== "interviewer") {
    return NextResponse.json({ error: "That message can't be read aloud." }, { status: 404 });
  }

  try {
    const { audio, contentType } = await synthesizeSpeech(turn.content);
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(audio.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof VoiceServiceError ? err.message : "Couldn't generate audio — try again.";
    console.error(`Interview speech synthesis failed for session ${sessionId}:`, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
