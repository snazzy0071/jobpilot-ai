/**
 * The only error shape src/lib/voice/transcription.ts and
 * src/lib/voice/speech.ts throw to callers — mirrors
 * src/lib/ai/errors.ts's AIServiceError for the same reason: a message
 * that's always safe to show a user, with the real provider error
 * logged server-side (console.error), never forwarded.
 */
export class VoiceServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "not_configured" | "provider_error" | "timeout" | "invalid_audio",
  ) {
    super(message);
    this.name = "VoiceServiceError";
  }
}
