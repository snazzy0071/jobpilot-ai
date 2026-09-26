// Writes a real, minimal one-page PDF with real embedded, selectable text — for a test that needs to upload an
// actual PDF (not a renamed non-PDF file) through the app's own magic-byte + pdf-parse pipeline. Usage:
//   node e2e/support/make-test-pdf.mjs <outputPath> "<text>"
// Same rendering engine (plain Puppeteer) the app itself uses for CV/cover-letter export, just run directly here
// rather than through the server.
import fs from "node:fs";
import puppeteer from "puppeteer";

const [outputPath, text] = process.argv.slice(2);
if (!outputPath || !text) {
  console.error("usage: make-test-pdf.mjs <outputPath> <text>");
  process.exit(1);
}

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<html><body style="font-family: Arial, sans-serif; font-size: 14px;"><p>${text}</p></body></html>`);
  const buffer = await page.pdf({ printBackground: true });
  fs.writeFileSync(outputPath, buffer);
} finally {
  await browser.close();
}
