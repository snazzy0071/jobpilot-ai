import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expect } from "@playwright/test";
import { getAdminClient } from "../support/admin-client";
import { seedCv } from "../support/cv";
import { makeCvTest, norm, previewDoc } from "../support/cv-fixture";
import { CV_TEMPLATES } from "../../src/config/cv-templates";

// All 24 templates, one by one: each renders the CV's full content in the editor preview, exports to a PDF that is
// drawn from the same template and data (every word the preview shows is in the PDF, in the same order, on the same
// number of pages), stays within two pages, and is visibly its own design — no two templates are near-copies.

const test = makeCvTest({ name: "CV Templates Tester", plan: "elite" });
const db = () => getAdminClient();
const SHOTS = path.join("test-results", "template-shots");

function pdfText(file: string): { text: string; pages: number } {
  const output = execFileSync(process.execPath, [path.join(process.cwd(), "e2e/support/pdf-text.mjs"), file], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return JSON.parse(output) as { text: string; pages: number };
}
const words = (text: string) => new Set((text.toLowerCase().match(/[a-z0-9']{4,}/g) ?? []).filter((word) => !/^\d+$/.test(word) || word.length === 4));

/** Every section the CV can have, so every template's section styles are exercised, not just the common ones. */
async function addEverySection(userId: string, versionId: string) {
  const rows = [
    db().from("cv_projects").insert({ cv_version_id: versionId, user_id: userId, name: "Atlas Migration", url: "https://example.com/atlas", technologies: ["Go", "Postgres"], description: "Moved forty services without downtime.", display_order: 0 }),
    db().from("cv_certifications").insert({ cv_version_id: versionId, user_id: userId, name: "Certified Kubernetes Administrator", issuing_organization: "CNCF", issue_date: "2022-04-01", display_order: 0 }),
    db().from("cv_languages").insert({ cv_version_id: versionId, user_id: userId, name: "Welsh", proficiency: "fluent", display_order: 0 }),
    db().from("cv_custom_sections").insert({ cv_version_id: versionId, user_id: userId, title: "Volunteering", content: "Mentors graduates every month.", display_order: 0 }),
  ];
  for (const result of await Promise.all(rows)) if (result.error) throw new Error(`couldn't add a section: ${result.error.message}`);
}

test.describe("each of the 24 templates", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

  for (const template of CV_TEMPLATES) {
    test(`${template.name} (${template.slug}): renders the whole CV, exports the same CV as a PDF within two pages`, async ({ open, account }) => {
      test.setTimeout(3 * 60_000);
      const { cvId, versionId } = await seedCv(account.user.id, { template: template.slug });
      await addEverySection(account.user.id, versionId);
      const page = await open();
      await page.goto(`/dashboard/cvs/${cvId}`);
      await page.getByRole("button", { name: "Reject non-essential" }).click({ timeout: 2000 }).catch(() => undefined);

      // The preview is this template, with every section's content.
      await expect(page.locator("[data-cv-template]").first()).toHaveAttribute("data-cv-template", template.slug);
      const preview = previewDoc(page);
      for (const needle of ["Ada Persist", "Marlow Tech", "Northbridge University", "TypeScript", "Atlas Migration", "Certified Kubernetes Administrator", "Welsh", "Volunteering"]) {
        await expect(preview, `${template.slug}: preview shows "${needle}"`).toContainText(needle);
      }
      await expect(page.getByText(/Fits on \d pages? \(A4\)/), `${template.slug}: fits the two-page limit`).toBeVisible();
      // A4Page re-measures as webfonts finish loading (fonts.ready) and can report a page count that isn't final yet;
      // wait for two reads in a row to agree before trusting it, rather than racing the very first render.
      const readPageCount = async () => Number(/Fits on (\d+) page/.exec(await page.getByText(/Fits on \d pages? \(A4\)/).innerText())?.[1]);
      let previewPages = await readPageCount();
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(300);
        const next = await readPageCount();
        if (next === previewPages) break;
        previewPages = next;
      }
      expect(previewPages).toBeLessThanOrEqual(2);
      const previewText = norm(await preview.innerText());
      await preview.screenshot({ path: path.join(SHOTS, `${template.slug}.png`) });

      // The export is that template and that version.
      const response = await page.request.get(`/api/cvs/${cvId}/export?template=${template.slug}`);
      expect(response.status(), `${template.slug}: export status`).toBe(200);
      expect(response.headers()["content-type"]).toBe("application/pdf");
      expect(response.headers()["x-cv-template"]).toBe(template.slug);
      expect(response.headers()["x-cv-version"]).toBe(versionId);
      const file = path.join(SHOTS, `${template.slug}.pdf`);
      fs.writeFileSync(file, await response.body());
      const pdf = pdfText(file);

      // Real, selectable text (not an image): the content is extractable from the PDF.
      for (const needle of ["Ada Persist", "Marlow Tech", "Northbridge University", "TypeScript", "Atlas Migration", "Volunteering"]) {
        // Case-insensitive: some templates set headings in capitals, and the PDF text carries the displayed case.
        expect(pdf.text.toLowerCase(), `${template.slug}: PDF text contains "${needle}"`).toContain(needle.toLowerCase());
      }
      expect(pdf.pages, `${template.slug}: PDF page count`).toBeLessThanOrEqual(2);
      expect(pdf.pages, `${template.slug}: PDF pages match the preview`).toBe(previewPages);

      // Every word of the preview is in the PDF...
      const inPdf = words(pdf.text);
      const missing = [...words(previewText)].filter((word) => !inPdf.has(word));
      expect(missing, `${template.slug}: words in the preview but not the PDF: ${missing.slice(0, 10).join(", ")}`).toEqual([]);
      // ...and the PDF holds nothing the preview doesn't (no cookie banner, chrome or stray text printed onto the CV),
      // with headings extracted as whole words rather than letter by letter.
      const inPreview = words(previewText);
      const extra = [...inPdf].filter((word) => !inPreview.has(word));
      expect(extra, `${template.slug}: words in the PDF but not the preview: ${extra.slice(0, 10).join(", ")}`).toEqual([]);
      expect(pdf.text, `${template.slug}: letter-spaced headings must not extract as "E D U C A T I O N"`).not.toMatch(/(?:^|\s)(?:[A-Z] ){4,}[A-Z](?:\s|$)/);
      // ...and the sections come in the same order in both.
      // Main-column landmarks only: in a sidebar template, text extraction reads the two columns in paint order, so
      // sidebar sections (certifications, languages...) legitimately interleave with the main column in the PDF text.
      const landmarks =
        template.layout === "single"
          ? ["Ada Persist", "Marlow Tech", "Northbridge Partners", "Northbridge University", "Atlas Migration", "Certified Kubernetes Administrator", "Volunteering"]
          : ["Ada Persist", "Marlow Tech", "Northbridge Partners"];
      const orderIn = (text: string) => landmarks.map((needle) => ({ needle, at: text.toLowerCase().indexOf(needle.toLowerCase()) })).sort((a, b) => a.at - b.at).map((entry) => entry.needle);
      expect(orderIn(pdf.text), `${template.slug}: section order, PDF vs preview`).toEqual(orderIn(previewText));
    });
  }

  test("no two templates look alike: every pair of previews differs in layout, not just colour", async () => {
    const size = { width: 96, height: 136 };
    const signature = async (slug: string) => {
      // Grayscale, normalised, so a recolour of the same layout would still match; only structure and typography count.
      const { data } = await sharp(path.join(SHOTS, `${slug}.png`)).resize(size.width, size.height, { fit: "fill" }).grayscale().normalise().raw().toBuffer({ resolveWithObject: true });
      return data;
    };
    const signatures = new Map<string, Buffer>();
    for (const template of CV_TEMPLATES) signatures.set(template.slug, await signature(template.slug));

    const distance = (a: Buffer, b: Buffer) => {
      let total = 0;
      for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
      return total / a.length / 255; // 0 = identical, 1 = opposite
    };
    const pairs: { a: string; b: string; d: number }[] = [];
    const slugs = [...signatures.keys()];
    for (let i = 0; i < slugs.length; i++) for (let j = i + 1; j < slugs.length; j++) pairs.push({ a: slugs[i], b: slugs[j], d: distance(signatures.get(slugs[i])!, signatures.get(slugs[j])!) });
    pairs.sort((x, y) => x.d - y.d);
    console.log("closest template pairs:", pairs.slice(0, 6).map((pair) => `${pair.a}~${pair.b}=${pair.d.toFixed(3)}`).join("  "));
    const tooClose = pairs.filter((pair) => pair.d < 0.02);
    expect(tooClose, `near-identical templates: ${tooClose.map((pair) => `${pair.a}/${pair.b}`).join(", ")}`).toEqual([]);
  });
});
