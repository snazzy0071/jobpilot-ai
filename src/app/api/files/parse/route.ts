import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/ai/rate-limit";
import { parseDocument, MAX_FILE_SIZE_BYTES } from "@/lib/files/parse-document";
import { isSameOriginRequest } from "@/lib/security/same-origin";

export const dynamic = "force-dynamic";
// Parsing a large PDF/DOCX can take a few seconds; 30s leaves margin.
export const maxDuration = 30;

const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

/**
 * Browsers don't always set a useful `File.type` for plain text (an
 * empty string is common for unrecognised extensions) — fall back to the
 * filename's extension only when the browser genuinely supplied nothing,
 * never in place of it. This is purely a courtesy for that one gap:
 * parseDocument still independently verifies the real content against
 * whatever type ends up here, so a spoofed extension gains nothing.
 */
function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  return EXTENSION_MIME_FALLBACK[extension] ?? "";
}

/**
 * Extracts plain text from an uploaded PDF, DOCX, or plain-text file —
 * see src/lib/files/parse-document.ts for the actual validation/
 * extraction logic. The file itself is never persisted (not written to
 * Supabase Storage or anywhere else); it's read into memory, parsed, and
 * discarded once this request completes.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Refuse an obviously oversized body before reading any of it (the size check below runs only after the whole upload is in memory).
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_FILE_SIZE_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "That file is too large — the limit is 10MB." }, { status: 413 });
  }

  const user = await requireUser();
  if (!(await consumeRateLimit(user.id, "file_parse")).allowed) {
    return NextResponse.json({ error: "You're uploading too quickly — wait a moment and try again." }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Couldn't read that upload — try again." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "That file is too large — the limit is 10MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await parseDocument(buffer, inferMimeType(file));

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ document: result.document });
}
