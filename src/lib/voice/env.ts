import "server-only";
import { z } from "zod";

/**
 * Validated lazily, same reasoning as src/lib/ai/env.ts: an eager throw
 * at module load would fail `next build` the moment any page's bundle
 * references the voice module, not just fail at the point a voice-mode
 * session actually calls a provider. A chat-only deployment can leave
 * every one of these unset and never hit this.
 *
 * `STT_PROVIDER`/`TTS_PROVIDER` are the actual provider-abstraction
 * switch — src/lib/voice/transcription.ts and src/lib/voice/speech.ts
 * read these to decide which src/lib/voice/providers/* implementation
 * to call, so swapping providers is a config change, not a code change
 * at any call site.
 */

const sttEnvSchema = z.object({
  STT_PROVIDER: z.enum(["openai"]).default("openai"),
  OPENAI_API_KEY: z.string().min(1, "is required"),
});
export type SttEnv = z.infer<typeof sttEnvSchema>;

let cachedStt: SttEnv | null = null;

export function getSttEnv(): SttEnv {
  if (cachedStt) return cachedStt;

  const parsed = sttEnvSchema.safeParse({
    STT_PROVIDER: process.env.STT_PROVIDER || undefined,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Voice transcription isn't configured (see .env.example):\n${issues}`);
  }
  cachedStt = parsed.data;
  return cachedStt;
}

const ttsEnvSchema = z.object({
  TTS_PROVIDER: z.enum(["elevenlabs"]).default("elevenlabs"),
  ELEVENLABS_API_KEY: z.string().min(1, "is required"),
  // Picked once by whoever configures the deployment — a specific voice
  // id from their ElevenLabs Voice Library with a British English
  // accent, per this feature's "British-voice TTS" requirement. Not
  // hardcoded here: a voice id that happens to exist in one account's
  // library isn't guaranteed to exist (or still be British-accented) in
  // another's, so this is a required, documented env var rather than a
  // guessed default.
  ELEVENLABS_VOICE_ID: z.string().min(1, "is required"),
});
export type TtsEnv = z.infer<typeof ttsEnvSchema>;

let cachedTts: TtsEnv | null = null;

export function getTtsEnv(): TtsEnv {
  if (cachedTts) return cachedTts;

  const parsed = ttsEnvSchema.safeParse({
    TTS_PROVIDER: process.env.TTS_PROVIDER || undefined,
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Voice synthesis isn't configured (see .env.example):\n${issues}`);
  }
  cachedTts = parsed.data;
  return cachedTts;
}
