import { describe, expect, it, vi } from "vitest";
import { detectFileKind, looksLikePlainText } from "@/lib/files/magic-bytes";
import { MAX_FILE_SIZE_BYTES, parseDocument } from "@/lib/files/parse-document";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const LONG_TEXT = "Experienced analyst with five years of reporting, forecasting and stakeholder work across finance teams.";

describe("detectFileKind", () => {
  it("reads the kind from the bytes, not from a name or type", () => {
    expect(detectFileKind(Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
    expect(detectFileKind(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe("docx");
    expect(detectFileKind(Buffer.from(LONG_TEXT))).toBe("text");
  });

  it("does not call binary noise text", () => {
    const noise = Buffer.alloc(200);
    for (let i = 0; i < noise.length; i++) noise[i] = i % 7 === 0 ? 0 : 65;
    expect(looksLikePlainText(noise)).toBe(false);
    expect(detectFileKind(noise)).toBe("unknown");
    expect(looksLikePlainText(Buffer.alloc(0))).toBe(false);
  });

  it("allows an occasional stray control byte in real text", () => {
    const text = Buffer.from(`${LONG_TEXT.repeat(20)}\u0001`);
    expect(looksLikePlainText(text)).toBe(true);
  });
});

describe("parseDocument", () => {
  it("returns the text of a plain text file", async () => {
    const result = await parseDocument(Buffer.from(LONG_TEXT), "text/plain");
    expect(result).toEqual({ document: { text: LONG_TEXT, fileType: "text", formatAnalysis: null } });
  });

  it("refuses an empty file, an oversized file and an unsupported type before reading anything", async () => {
    expect(await parseDocument(Buffer.alloc(0), "text/plain")).toEqual({ error: "That file is empty." });
    expect(await parseDocument(Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 65), "text/plain")).toEqual({ error: expect.stringContaining("too large") });
    expect(await parseDocument(Buffer.from(LONG_TEXT), "image/png")).toEqual({ error: expect.stringContaining("Only PDF, DOCX") });
  });

  it("refuses a file whose real content disagrees with the type it claims", async () => {
    expect(await parseDocument(Buffer.from("%PDF-1.4 fake"), "text/plain")).toEqual({ error: expect.stringContaining("don't match") });
    expect(await parseDocument(Buffer.from(LONG_TEXT), "application/pdf")).toEqual({ error: expect.stringContaining("don't match") });
  });

  it("refuses binary content and text with too little in it", async () => {
    const noise = Buffer.alloc(200);
    for (let i = 0; i < noise.length; i++) noise[i] = i % 5 === 0 ? 0 : 66;
    expect(await parseDocument(noise, "text/plain")).toEqual({ error: expect.stringContaining("valid PDF, DOCX, or plain text") });
    expect(await parseDocument(Buffer.from("too short"), "text/plain")).toEqual({ error: expect.stringContaining("enough readable text") });
  });

  it("reports a corrupt PDF or DOCX as a safe message instead of throwing", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pdf = await parseDocument(Buffer.from("%PDF-1.4 this is not really a pdf"), "application/pdf");
    expect("error" in pdf).toBe(true);
    const docx = await parseDocument(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5]), DOCX);
    expect(docx).toEqual({ error: expect.stringContaining("docx") });
    quiet.mockRestore();
  });
});
