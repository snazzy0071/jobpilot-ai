/**
 * Audio-kind detection from real bytes, never from a client-supplied
 * Content-Type or filename — same "don't trust the declared type"
 * principle as src/lib/files/magic-bytes.ts, applied to the interview
 * voice-transcribe upload instead of CV/cover-letter documents. A
 * browser's `MediaRecorder` produces webm/ogg in practice, but this
 * checks the container signature itself rather than assuming.
 */
export type DetectedAudioKind = "webm" | "ogg" | "wav" | "mp3" | "mp4" | "unknown";

// WebM/Matroska's EBML header — also mp4/m4a's sibling container format
// in spirit, but a genuinely different magic number.
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const OGG_MAGIC = Buffer.from("OggS", "ascii");
const RIFF_MAGIC = Buffer.from("RIFF", "ascii");
const WAVE_MAGIC = Buffer.from("WAVE", "ascii");
const ID3_MAGIC = Buffer.from("ID3", "ascii");

/** A raw (ID3-less) MPEG audio frame's 11-bit sync word: 0xFF followed by the top 3 bits of the next byte all set. */
function isMp3FrameSync(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
}

/** ISO-BMFF (MP4/M4A) — a 4-byte box size (any value) immediately followed by the literal box type `ftyp`. */
function isIsoBmff(buffer: Buffer): boolean {
  return buffer.length >= 8 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

export function detectAudioKind(buffer: Buffer): DetectedAudioKind {
  if (buffer.subarray(0, WEBM_MAGIC.length).equals(WEBM_MAGIC)) return "webm";
  if (buffer.subarray(0, OGG_MAGIC.length).equals(OGG_MAGIC)) return "ogg";
  if (buffer.subarray(0, RIFF_MAGIC.length).equals(RIFF_MAGIC) && buffer.subarray(8, 12).equals(WAVE_MAGIC)) return "wav";
  if (buffer.subarray(0, ID3_MAGIC.length).equals(ID3_MAGIC) || isMp3FrameSync(buffer)) return "mp3";
  if (isIsoBmff(buffer)) return "mp4";
  return "unknown";
}
