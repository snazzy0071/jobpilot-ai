import "server-only";
import { getTtsEnv } from "@/lib/voice/env";
import { synthesizeWithElevenLabs, type SynthesizedSpeech } from "@/lib/voice/providers/elevenlabs";
import { VoiceServiceError } from "@/lib/voice/errors";

/**
 * The one seam every caller (the speak route) goes through instead of
 * importing a specific provider directly — mirrors
 * src/lib/voice/transcription.ts's transcribeAudio for text-to-speech.
 * Which concrete provider runs is chosen once, by TTS_PROVIDER
 * (src/lib/voice/env.ts).
 */
export async function synthesizeSpeech(text: string): Promise<SynthesizedSpeech> {
  const { TTS_PROVIDER } = getTtsEnv();

  switch (TTS_PROVIDER) {
    case "elevenlabs":
      return synthesizeWithElevenLabs(text);
    default:
      throw new VoiceServiceError("Voice features aren't available right now.", "not_configured");
  }
}

export { VoiceServiceError } from "@/lib/voice/errors";
