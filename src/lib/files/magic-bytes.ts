/**
 * File-kind detection from real bytes, never from a client-supplied
 * Content-Type or filename extension — both can claim anything
 * regardless of what was actually uploaded. DOCX (and every other
 * OOXML/zip-based format) shares the same outer ZIP magic bytes;
 * distinguishing a real DOCX from an arbitrary zip happens one layer up
 * when mammoth actually opens it (src/lib/files/parse-document.ts) —
 * this is only the fast, cheap first check, done before any parsing
 * library ever touches the bytes.
 */
export type DetectedFileKind = "pdf" | "docx" | "text" | "unknown";

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

// A byte below 0x20 that isn't tab/newline/CR is control/binary noise a
// real text document wouldn't contain in any quantity — null bytes in
// particular never appear in genuine UTF-8/ASCII text. A small tolerance
// (not zero) avoids false-rejecting text with an odd stray control byte.
const MAX_BINARY_BYTE_RATIO = 0.01;
const TEXT_SNIFF_SAMPLE_SIZE = 8000;

function isBinaryNoiseByte(byte: number): boolean {
  if (byte === 0x09 || byte === 0x0a || byte === 0x0d) return false; // tab, \n, \r
  return byte < 0x20;
}

/** Real content heuristic, not just "isn't a known binary format" — genuine binary garbage mislabelled as text is rejected here. */
export function looksLikePlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, TEXT_SNIFF_SAMPLE_SIZE));

  let binaryByteCount = 0;
  for (const byte of sample) {
    if (isBinaryNoiseByte(byte)) binaryByteCount++;
  }
  return binaryByteCount / sample.length <= MAX_BINARY_BYTE_RATIO;
}

export function detectFileKind(buffer: Buffer): DetectedFileKind {
  if (buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) return "pdf";
  if (buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) return "docx";
  if (looksLikePlainText(buffer)) return "text";
  return "unknown";
}
