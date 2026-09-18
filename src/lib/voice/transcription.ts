import "server-only";
import { getSttEnv } from "@/lib/voice/env";
import { transcribeWithOpenAI } from "@/lib/voice/providers/openai-whisper";
import { VoiceServiceError } from "@/lib/voice/errors";

/**
 * The one seam every caller (the transcribe route) goes through instead
 * of importing a specific provider directly — same "swap the
 * implementation behind one function" shape as src/lib/ai/gateway.ts
 * sitting in front of src/lib/ai/service.ts, just for speech-to-text.
 * Which concrete provider runs is chosen once, by STT_PROVIDER
 * (src/lib/voice/env.ts) — adding a second provider later means a new
 * file under providers/ and one more case here, no call-site changes.
 */
export async function transcribeAudio(audio: Buffer, mimeType: string, filename: string): Promise<string> {
  const { STT_PROVIDER } = getSttEnv();

  switch (STT_PROVIDER) {
    case "openai":
      return transcribeWithOpenAI(audio, mimeType, filename);
    default:
      throw new VoiceServiceError("Voice features aren't available right now.", "not_configured");
  }
}

export { VoiceServiceError } from "@/lib/voice/errors";
