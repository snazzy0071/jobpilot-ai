// Reads a PDF and prints { text, pages } as JSON. Kept as a small separate Node script so the spec doesn't need
// pdf.js inside Playwright's transpiled test realm. The two reads are sequential on purpose: pdf.js transfers the
// document's buffer to its worker on the first call, so issuing both at once fails with a DataCloneError.
import fs from "node:fs";
import { PDFParse } from "pdf-parse";

const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(process.argv[2])) });
try {
  const info = await parser.getInfo();
  const { text } = await parser.getText();
  process.stdout.write(JSON.stringify({ text, pages: info.total }));
} finally {
  await parser.destroy();
}
