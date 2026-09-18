import "server-only";
import { getTtsEnv } from "@/lib/voice/env";
import { VoiceServiceError } from "@/lib/voice/errors";
import { readResponseWithCap, exceedsDeclaredLength } from "@/lib/net/response-cap";

const REQUEST_TIMEOUT_MS = 30_000;
// Generous for a few sentences of synthesized speech (one interview
// turn) — well above any realistic single-turn audio size, still a
// hard bound against a misbehaving response consuming unbounded memory.
const MAX_RESPONSE_BYTES = 15 * 1024 * 1024;

export type SynthesizedSpeech = { audio: Buffer; contentType: string };

/** Text-to-speech via ElevenLabs — a plain REST call, no SDK dependency needed. `ELEVENLABS_VOICE_ID` (src/lib/voice/env.ts) is the operator's chosen British-accented voice; this file has no opinion on which one. Called only through src/lib/voice/speech.ts's provider switch, never directly. */
export async function synthesizeWithElevenLabs(text: string): Promise<SynthesizedSpeech> {
  const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID } = getTtsEnv();

  let response: Response;
  try {
    response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new VoiceServiceError("That took too long to generate — try again.", "timeout");
    }
    throw new VoiceServiceError("Couldn't reach the speech service — try again.", "provider_error");
  }

  if (response.status === 401) {
    throw new VoiceServiceError("Voice features aren't available right now.", "not_configured");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`ElevenLabs synthesis failed [${response.status}]:`, body.slice(0, 300));
    throw new VoiceServiceError("Couldn't generate audio — try again.", "provider_error");
  }

  if (exceedsDeclaredLength(response, MAX_RESPONSE_BYTES)) {
    throw new VoiceServiceError("Couldn't generate audio — try again.", "provider_error");
  }
  const audio = await readResponseWithCap(response, MAX_RESPONSE_BYTES);
  if (audio === null) {
    throw new VoiceServiceError("Couldn't generate audio — try again.", "provider_error");
  }

  return { audio, contentType: "audio/mpeg" };
}
