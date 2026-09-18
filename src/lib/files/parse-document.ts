import "server-only";
import { PDFParse, PasswordException, InvalidPDFException } from "pdf-parse";
import mammoth from "mammoth";
import { detectFileKind } from "@/lib/files/magic-bytes";
import { analyzePdfFormat, analyzeDocxFormat, type AtsFormatAnalysis } from "@/lib/files/ats-format-analysis";

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

// Below this, treat extraction as having failed even though the library
// didn't throw — a scanned/image-only PDF is the classic case: pdf-parse
// succeeds and returns a string, it's just empty or near-empty, since
// there's no real text layer to read.
const MIN_EXTRACTED_TEXT_LENGTH = 50;

// Defensive ceiling on the *output*, independent of the 10MB input cap —
// a small, maliciously crafted DOCX (a zip) can decompress to something
// far larger than its own file size ("zip bomb"); this bounds what can
// ever flow downstream regardless of how much mammoth/pdf-parse produce.
const MAX_EXTRACTED_TEXT_LENGTH = 500_000;

export type ParsedDocumentFileType = "pdf" | "docx" | "text";

export type ParsedDocument = {
  text: string;
  fileType: ParsedDocumentFileType;
  /**
   * Deterministic ATS-format diagnostics (src/lib/files/
   * ats-format-analysis.ts) — null for plain text, which has no format
   * to check beyond "is it readable text", already covered by a
   * successful parse. Entirely independent of the AI ATS scan engine's
   * own `scores.format` (src/lib/ai/prompts/ats-scan.ts) — see that
   * module's doc comment for why the two are deliberately never merged.
   */
  formatAnalysis: AtsFormatAnalysis | null;
};

export type ParseDocumentResult = { error: string } | { document: ParsedDocument };

function truncate(text: string): string {
  return text.length > MAX_EXTRACTED_TEXT_LENGTH ? text.slice(0, MAX_EXTRACTED_TEXT_LENGTH) : text;
}

async function parsePdf(buffer: Buffer): Promise<ParseDocumentResult> {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = truncate(result.text.trim());
    if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
      return {
        error: "Couldn't find any readable text in that PDF — it may be a scanned image rather than a real text document.",
      };
    }
    // Reuses this same open `parser` and the `result` already fetched
    // above, rather than re-parsing the PDF a second time.
    const formatAnalysis = await analyzePdfFormat(parser, result, buffer);
    return { document: { text, fileType: "pdf", formatAnalysis } };
  } catch (err) {
    if (err instanceof PasswordException) {
      return { error: "That PDF is password-protected — remove the password and try again." };
    }
    if (err instanceof InvalidPDFException) {
      return { error: "That file doesn't look like a valid PDF." };
    }
    console.error("PDF parsing failed:", err);
    return { error: "Couldn't read that PDF — try again." };
  } finally {
    if (parser) await parser.destroy();
  }
}

async function parseDocx(buffer: Buffer): Promise<ParseDocumentResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = truncate(result.value.trim());
    if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
      return { error: "Couldn't find any readable text in that document." };
    }
    const formatAnalysis = await analyzeDocxFormat(buffer, result.messages);
    return { document: { text, fileType: "docx", formatAnalysis } };
  } catch (err) {
    console.error("DOCX parsing failed:", err);
    return { error: "Couldn't read that file — make sure it's a real .docx document." };
  }
}

function parsePlainText(buffer: Buffer): ParseDocumentResult {
  const text = truncate(buffer.toString("utf-8").trim());
  if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
    return { error: "That file doesn't have enough readable text to use." };
  }
  return { document: { text, fileType: "text", formatAnalysis: null } };
}

/**
 * Server-only. Validates size, then sniffs the *real* file kind from its
 * magic bytes (src/lib/files/magic-bytes.ts) and requires it to agree
 * with `declaredMimeType` — a mismatch (a mislabelled or spoofed upload)
 * is rejected outright, the declared type is never trusted on its own.
 * Extracts plain text with the matching library, and never throws:
 * every real failure mode — wrong/corrupted format, a password-protected
 * PDF, a scanned/image-only PDF with no real text layer, an empty file —
 * comes back as a safe, specific `{ error }` instead of an exception.
 */
export async function parseDocument(buffer: Buffer, declaredMimeType: string): Promise<ParseDocumentResult> {
  if (buffer.length === 0) {
    return { error: "That file is empty." };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { error: "That file is too large — the limit is 10MB." };
  }
  if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) {
    return { error: "Only PDF, DOCX, and plain text files are supported." };
  }

  const kind = detectFileKind(buffer);
  if (kind === "unknown") {
    return { error: "That file doesn't look like a valid PDF, DOCX, or plain text file." };
  }

  const kindMatchesDeclaredType =
    (kind === "pdf" && declaredMimeType === "application/pdf") ||
    (kind === "docx" &&
      declaredMimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
    (kind === "text" && declaredMimeType === "text/plain");
  if (!kindMatchesDeclaredType) {
    return { error: "That file's contents don't match its type — try re-saving and uploading it again." };
  }

  if (kind === "pdf") return parsePdf(buffer);
  if (kind === "docx") return parseDocx(buffer);
  return parsePlainText(buffer);
}
