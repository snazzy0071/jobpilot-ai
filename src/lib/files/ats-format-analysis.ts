import "server-only";
import JSZip from "jszip";
import type { PDFParse, TextResult } from "pdf-parse";

/**
 * Deterministic ATS-format diagnostics for an uploaded PDF/DOCX — real
 * structural facts read from the file itself (embedded font names, a
 * table grid, a multi-column section, a heading style, a mammoth
 * conversion warning), never a guess. This is a separate signal from
 * Claude's own `scores.format` in the ATS scan engine
 * (src/lib/ai/prompts/ats-scan.ts) — that judges a CV builder version's
 * *content*, written from the app's own always-ATS-safe templates; this
 * judges the *actual file* a user uploaded, which the CV builder never
 * produces and Claude never sees the raw bytes of. Neither is meant to
 * replace the other, and this module never feeds into or reads
 * `ats_scans.format_score`.
 *
 * Columns and headings are checked for DOCX (both are exact, readable
 * facts in its XML), deliberately NOT for PDF: pdf-parse's public API
 * (src/lib/files/parse-document.ts) exposes page text but no per-run
 * position or font-size data, which real column/heading detection would
 * need. Rather than fake a heuristic that looks like a real check but
 * isn't reliable, PDF simply doesn't emit those two checks — see
 * analyzePdfFormat's own comment.
 */

export type AtsFormatCheckId =
  | "selectable-text"
  | "image-text"
  | "columns"
  | "tables"
  | "headings"
  | "fonts"
  | "parsing-quality";

export type AtsFormatCheck = {
  id: AtsFormatCheckId;
  passed: boolean;
  severity: "warning" | "info";
  message: string;
};

export type AtsFormatAnalysis = {
  score: number;
  checks: AtsFormatCheck[];
};

const STANDARD_FONT_NAMES = [
  "arial",
  "helvetica",
  "times new roman",
  "times",
  "georgia",
  "calibri",
  "cambria",
  "verdana",
  "garamond",
  "courier",
  "tahoma",
  "trebuchet ms",
  "segoe ui",
  "book antiqua",
  "century gothic",
  "lato",
  "open sans",
  "roboto",
  "source sans pro",
];

function isStandardFont(name: string): boolean {
  const normalized = name.toLowerCase();
  return STANDARD_FONT_NAMES.some((standard) => normalized.includes(standard));
}

const CHECK_PENALTY: Record<AtsFormatCheck["severity"], number> = { warning: 20, info: 8 };

function scoreFromChecks(checks: AtsFormatCheck[]): number {
  const penalty = checks.filter((check) => !check.passed).reduce((sum, check) => sum + CHECK_PENALTY[check.severity], 0);
  return Math.max(0, 100 - penalty);
}

function joinPageNumbers(pages: number[]): string {
  return pages.join(", ");
}

// PDF font names are almost always subset-prefixed by the embedding
// tool — six uppercase letters and a `+` (e.g. "AAAAAA+ArialMT") — which
// has to be stripped before comparing against a real font name.
const PDF_SUBSET_PREFIX = /^[A-Z]{6}\+/;

function extractPdfFontNames(buffer: Buffer): string[] {
  const raw = buffer.toString("latin1");
  const names = [...raw.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+,#-]+)/g)].map((match) =>
    match[1].replace(PDF_SUBSET_PREFIX, ""),
  );
  return [...new Set(names)];
}

/**
 * `textResult` and `parser` are both already-open from parseDocument's
 * own extraction — reused here rather than re-parsing the same PDF a
 * second time.
 */
export async function analyzePdfFormat(
  parser: PDFParse,
  textResult: TextResult,
  buffer: Buffer,
): Promise<AtsFormatAnalysis> {
  const checks: AtsFormatCheck[] = [];

  const thinPages = textResult.pages.filter((page) => page.text.trim().length < 50).map((page) => page.num);
  checks.push({
    id: "selectable-text",
    passed: thinPages.length === 0,
    severity: "warning",
    message:
      thinPages.length === 0
        ? "Every page has real, selectable text."
        : `Page${thinPages.length > 1 ? "s" : ""} ${joinPageNumbers(thinPages)} ${thinPages.length > 1 ? "have" : "has"} very little selectable text — check it isn't a scanned image.`,
  });

  const fontNames = extractPdfFontNames(buffer);
  const nonStandardFonts = fontNames.filter((name) => !isStandardFont(name));
  checks.push({
    id: "fonts",
    passed: nonStandardFonts.length === 0,
    severity: "info",
    message:
      nonStandardFonts.length === 0
        ? "Uses standard, widely-supported fonts."
        : `Uses non-standard font${nonStandardFonts.length > 1 ? "s" : ""} (${nonStandardFonts.join(", ")}) that some ATS parsers may not render correctly.`,
  });

  let pagesWithTables: number[] = [];
  try {
    const tableResult = await parser.getTable();
    pagesWithTables = tableResult.pages.filter((page) => page.tables.length > 0).map((page) => page.num);
  } catch (err) {
    console.error("PDF table detection failed:", err);
  }
  checks.push({
    id: "tables",
    passed: pagesWithTables.length === 0,
    severity: "warning",
    message:
      pagesWithTables.length === 0
        ? "No tables detected."
        : `Table layout detected on page${pagesWithTables.length > 1 ? "s" : ""} ${joinPageNumbers(pagesWithTables)} — tables often confuse ATS reading order.`,
  });

  let suspiciousImagePages: number[] = [];
  try {
    const imageResult = await parser.getImage();
    suspiciousImagePages = imageResult.pages
      .filter((page) => page.images.length > 0)
      .filter((page) => (textResult.pages.find((t) => t.num === page.pageNumber)?.text.trim().length ?? 0) < 100)
      .map((page) => page.pageNumber);
  } catch (err) {
    console.error("PDF image detection failed:", err);
  }
  checks.push({
    id: "image-text",
    passed: suspiciousImagePages.length === 0,
    severity: "warning",
    message:
      suspiciousImagePages.length === 0
        ? "No sign of text embedded only in an image."
        : `Page${suspiciousImagePages.length > 1 ? "s" : ""} ${joinPageNumbers(suspiciousImagePages)} ${suspiciousImagePages.length > 1 ? "have" : "has"} an image alongside very little real text — if that image contains text, an ATS can't read it.`,
  });

  // Not checked for PDF: "columns", "headings" — see the module doc
  // comment for why.

  const avgCharsPerPage = textResult.pages.length > 0 ? textResult.text.length / textResult.pages.length : 0;
  checks.push({
    id: "parsing-quality",
    passed: avgCharsPerPage >= 200,
    severity: "info",
    message:
      avgCharsPerPage >= 200
        ? "Extracted cleanly with a healthy amount of text per page."
        : "Relatively little text was extracted per page — the layout may not translate cleanly to plain text.",
  });

  return { score: scoreFromChecks(checks), checks };
}

export async function analyzeDocxFormat(
  buffer: Buffer,
  mammothMessages: { type: string; message: string }[],
): Promise<AtsFormatAnalysis> {
  const checks: AtsFormatCheck[] = [];

  let documentXml = "";
  try {
    const zip = await JSZip.loadAsync(buffer);
    documentXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  } catch (err) {
    console.error("DOCX structural analysis failed to read document.xml:", err);
  }

  const hasMultipleColumns = /<w:cols\b[^>]*\bw:num="(?:[2-9]|\d{2,})"/.test(documentXml);
  checks.push({
    id: "columns",
    passed: !hasMultipleColumns,
    severity: "warning",
    message: hasMultipleColumns
      ? "Multi-column layout detected — ATS parsers usually read left-to-right, top-to-bottom and can jumble multi-column text."
      : "Single-column layout.",
  });

  const hasTable = /<w:tbl\b/.test(documentXml);
  checks.push({
    id: "tables",
    passed: !hasTable,
    severity: "warning",
    message: hasTable ? "Table layout detected — tables often confuse ATS reading order." : "No tables detected.",
  });

  const hasHeadingStyle = /<w:pStyle\s+w:val="(?:Heading\d|Title)"/.test(documentXml);
  checks.push({
    id: "headings",
    passed: hasHeadingStyle,
    severity: "info",
    message: hasHeadingStyle
      ? "Uses real Word heading styles."
      : "No Word heading styles detected — section titles may just be bold text, which some ATS parsers don't recognise as headings.",
  });

  const fontNames = [...new Set([...documentXml.matchAll(/w:(?:ascii|hAnsi)="([^"]+)"/g)].map((match) => match[1]))];
  const nonStandardFonts = fontNames.filter((name) => !isStandardFont(name));
  checks.push({
    id: "fonts",
    passed: nonStandardFonts.length === 0,
    severity: "info",
    message:
      nonStandardFonts.length === 0
        ? "Uses standard, widely-supported fonts."
        : `Uses non-standard font${nonStandardFonts.length > 1 ? "s" : ""} (${nonStandardFonts.join(", ")}) that some ATS parsers may not render correctly.`,
  });

  const textRunCount = (documentXml.match(/<w:t[ >]/g) ?? []).length;
  const imageCount = (documentXml.match(/<w:drawing\b/g) ?? []).length;
  const imageHeavy = imageCount > 0 && textRunCount < imageCount * 2;
  checks.push({
    id: "image-text",
    passed: !imageHeavy,
    severity: "warning",
    message: imageHeavy
      ? "This document is mostly images with very little real text alongside them — if any of those images contain text, an ATS can't read it."
      : "No sign of text embedded only in an image.",
  });

  // DOCX text is always genuine, selectable XML text — there's no
  // scanned-image-as-a-whole-page failure mode the way PDF has.
  // "image-text" above is the meaningful equivalent for this format.
  checks.push({
    id: "selectable-text",
    passed: true,
    severity: "info",
    message: "DOCX text is always genuinely selectable.",
  });

  const structuralWarnings = mammothMessages.filter((message) => message.type === "warning" || message.type === "error");
  checks.push({
    id: "parsing-quality",
    passed: structuralWarnings.length === 0,
    severity: "info",
    message:
      structuralWarnings.length === 0
        ? "Converted cleanly with no structural warnings."
        : `${structuralWarnings.length} structural warning${structuralWarnings.length > 1 ? "s" : ""} while reading this document (e.g. unrecognised formatting).`,
  });

  return { score: scoreFromChecks(checks), checks };
}
