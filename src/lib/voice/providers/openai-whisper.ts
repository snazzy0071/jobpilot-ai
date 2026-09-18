import "server-only";
import { getSttEnv } from "@/lib/voice/env";
import { VoiceServiceError } from "@/lib/voice/errors";
import { readResponseWithCap, exceedsDeclaredLength } from "@/lib/net/response-cap";

const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const REQUEST_TIMEOUT_MS = 30_000;
// A transcription response is just a short JSON body — generous, still
// a hard bound against a misbehaving response.
const MAX_RESPONSE_BYTES = 1 * 1024 * 1024;

/** Speech-to-text via OpenAI's Whisper endpoint — a plain REST call (multipart upload), no SDK dependency needed. Called only through src/lib/voice/transcription.ts's provider switch, never directly. */
export async function transcribeWithOpenAI(audio: Buffer, mimeType: string, filename: string): Promise<string> {
  const { OPENAI_API_KEY } = getSttEnv();

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
  form.append("model", "whisper-1");

  let response: Response;
  try {
    response = await fetch(OPENAI_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new VoiceServiceError("That took too long to transcribe — try again.", "timeout");
    }
    throw new VoiceServiceError("Couldn't reach the transcription service — try again.", "provider_error");
  }

  if (response.status === 401 || response.status === 403) {
    // Never surface "invalid API key" to the user — operator problem, not theirs.
    throw new VoiceServiceError("Voice features aren't available right now.", "not_configured");
  }
  if (response.status === 400 || response.status === 415) {
    throw new VoiceServiceError("That recording couldn't be understood — try again.", "invalid_audio");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`OpenAI transcription failed [${response.status}]:`, body.slice(0, 300));
    throw new VoiceServiceError("Couldn't transcribe that recording — try again.", "provider_error");
  }

  if (exceedsDeclaredLength(response, MAX_RESPONSE_BYTES)) {
    throw new VoiceServiceError("Couldn't transcribe that recording — try again.", "provider_error");
  }
  const body = await readResponseWithCap(response, MAX_RESPONSE_BYTES);
  if (body === null) {
    throw new VoiceServiceError("Couldn't transcribe that recording — try again.", "provider_error");
  }

  const data = JSON.parse(body.toString("utf-8")) as { text?: string };
  return data.text ?? "";
}
