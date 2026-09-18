import "server-only";
import { siteConfig } from "@/config/site";
import { getCoverLetterEditorData } from "@/lib/cover-letters/queries";
import { launchBrowser } from "@/lib/pdf/launch-browser";

/**
 * Same real-headless-Chromium pattern as CV export
 * (src/lib/cvs/pdf-export.ts's doc comment explains why: genuine
 * embedded/selectable text via `page.pdf()`, never a rasterized
 * screenshot) — navigates to `/print/cover-letters/[id]` (the same app,
 * same auth, same CoverLetterTemplateRenderer the live preview uses)
 * and calls the real print API. The caller's own session cookies are
 * forwarded so the headless browser loads the print route as the same
 * authenticated user, same as the CV export.
 */
export async function generateCoverLetterPdf(
  userId: string,
  coverLetterId: string,
  requestCookies: { name: string; value: string }[],
): Promise<{ buffer: Buffer; title: string } | null> {
  const data = await getCoverLetterEditorData(userId, coverLetterId);
  if (!data) return null;

  const siteUrl = new URL(siteConfig.domain);
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    if (requestCookies.length > 0) {
      await page.setCookie(
        ...requestCookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: siteUrl.hostname,
          path: "/",
          secure: siteUrl.protocol === "https:",
        })),
      );
    }

    const response = await page.goto(`${siteConfig.domain}/print/cover-letters/${coverLetterId}`, {
      waitUntil: "networkidle0",
    });
    if (!response || !response.ok()) {
      throw new Error(`Print page responded with ${response ? response.status() : "no response"}`);
    }

    const buffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return { buffer: Buffer.from(buffer), title: `${data.jobTitle} at ${data.companyName}` };
  } finally {
    await browser.close();
  }
}
