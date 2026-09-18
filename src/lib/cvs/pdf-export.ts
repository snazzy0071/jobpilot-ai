import "server-only";
import { siteConfig } from "@/config/site";
import { getCvEditorData } from "@/lib/cvs/queries";
import { launchBrowser } from "@/lib/pdf/launch-browser";

/**
 * Server-generated PDF export - a headless Chromium (Puppeteer)
 * navigates to `/print/cvs/[cvId]` (the same app, same auth, same
 * `TemplateRenderer`/layout/theme components the live preview uses -
 * see that route and `TemplateRenderer`'s `mode="print"` for why this
 * keeps the export visually consistent with the preview by
 * construction, not by two independent implementations) and calls the
 * real `page.pdf()` print API.
 *
 * This is what makes the output ATS-safe in the ways that actually
 * matter: `page.pdf()` produces genuine embedded, selectable text
 * objects (never a rasterized image - that's simply what Chromium's
 * print pipeline is; a `page.screenshot()` would be the pixel version,
 * this never calls that), and the print page overrides this project's
 * on-screen webfont with real standard fonts (Georgia/Arial) so nothing
 * about the embedded text depends on a font an ATS parser might not
 * recognise or a viewer might not have installed.
 *
 * The caller's own session cookies are forwarded to the headless
 * browser so it loads the print route as the same authenticated user -
 * simpler and more robust than a second, parallel auth mechanism (a
 * signed token, say) just for this one internal navigation.
 */
export async function generateCvPdf(
  userId: string,
  cvId: string,
  requestCookies: { name: string; value: string }[],
): Promise<{ buffer: Buffer; title: string } | null> {
  const data = await getCvEditorData(userId, cvId);
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

    const response = await page.goto(`${siteConfig.domain}/print/cvs/${cvId}`, { waitUntil: "networkidle0" });
    if (!response || !response.ok()) {
      throw new Error(`Print page responded with ${response ? response.status() : "no response"}`);
    }

    const buffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return { buffer: Buffer.from(buffer), title: data.cvTitle };
  } finally {
    await browser.close();
  }
}

const UNSAFE_FILENAME_CHARS = /["*/:<>?\\|]/g;

/** Strips characters that would break a Content-Disposition filename or a real filesystem, and bounds the length - keeps spaces/hyphens, a CV title should stay readable. */
export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(UNSAFE_FILENAME_CHARS, "").trim();
  const fallback = cleaned.length > 0 ? cleaned : "CV";
  return fallback.slice(0, 100);
}
