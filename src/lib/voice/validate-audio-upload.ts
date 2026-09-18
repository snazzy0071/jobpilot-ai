import "server-only";
import { detectAudioKind, type DetectedAudioKind } from "@/lib/voice/audio-magic-bytes";

// Every format a real browser's MediaRecorder realistically produces
// (webm/ogg, both usually with an opus codec parameter) plus the other
// container formats Whisper documents support, in case a future
// non-MediaRecorder client (a native app, say) ever uploads here.
const KIND_BY_BASE_MIME_TYPE: Record<string, DetectedAudioKind> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "mp4",
  "audio/x-m4a": "mp4",
};

export type AudioUploadValidationResult = { error: string } | { kind: DetectedAudioKind };

/**
 * Server-only. Same shape as src/lib/files/parse-document.ts's own
 * declared-type-vs-real-bytes cross-check: a declared MIME type outside
 * the allowlist is rejected outright, and even an allowed one is only
 * trusted once the file's actual magic bytes agree with it — the
 * declared type is never used on its own to decide how to treat the
 * upload. `file.type` from `MediaRecorder`'s own blob commonly carries a
 * codec parameter (`audio/webm;codecs=opus`); only the base type before
 * `;` is compared against the allowlist/detected kind.
 */
export function validateAudioUpload(buffer: Buffer, declaredMimeType: string): AudioUploadValidationResult {
  const baseType = declaredMimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const expectedKind = KIND_BY_BASE_MIME_TYPE[baseType];
  if (!expectedKind) {
    return { error: "That recording's format isn't supported." };
  }

  const detectedKind = detectAudioKind(buffer);
  if (detectedKind === "unknown") {
    return { error: "That doesn't look like a valid audio recording." };
  }
  if (detectedKind !== expectedKind) {
    return { error: "That recording's contents don't match its declared format." };
  }

  return { kind: detectedKind };
}
