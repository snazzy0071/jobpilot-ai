// Writes a real, minimal, valid .docx with real text in a real paragraph — for a test that needs to upload an
// actual DOCX (not a renamed non-DOCX file) through the app's own magic-byte + mammoth pipeline. A .docx is just a
// zip of a few XML parts; JSZip is already a project dependency (used to read one, in src/lib/files/
// ats-format-analysis.ts's analyzeDocxFormat), so it's used here to write one instead. Usage:
//   node e2e/support/make-test-docx.mjs <outputPath> "<text>"
import fs from "node:fs";
import JSZip from "jszip";

const [outputPath, text] = process.argv.slice(2);
if (!outputPath || !text) {
  console.error("usage: make-test-docx.mjs <outputPath> <text>");
  process.exit(1);
}

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const zip = new JSZip();

zip.file(
  "[Content_Types].xml",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    "</Types>",
);

zip.file(
  "_rels/.rels",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    "</Relationships>",
);

// One heading-styled paragraph plus one body paragraph — real text runs a real reader (and mammoth) sees as two
// separate paragraphs, not a single blob.
zip.file(
  "word/document.xml",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    "<w:body>" +
    `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>` +
    "</w:body>" +
    "</w:document>",
);

const buffer = await zip.generateAsync({ type: "nodebuffer" });
fs.writeFileSync(outputPath, buffer);
