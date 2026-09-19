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
 * this never calls that). Each template sets its text in its own
 * self-hosted webfont pair (next/font), which Chromium subsets and
 * embeds in the PDF as an ordinary font with a Unicode map — so the
 * text stays selectable and extractable, nothing depends on a font the
 * viewer has installed, and the PDF is set in exactly the faces the
 * preview shows. Ligatures are switched off in the document so
 * "ffi"/"fi" always extract as plain letters.
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
  requestUrl?: string,
): Promise<{ buffer: Buffer; title: string; template: string; versionId: string } | null> {
  const data = await getCvEditorData(userId, cvId);
  if (!data) return null;

  const origin = resolveRenderOrigin(requestUrl);
  const siteUrl = new URL(origin);
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

    const response = await page.goto(`${origin}/print/cvs/${cvId}`, { waitUntil: "networkidle0" });
    if (!response || !response.ok()) {
      throw new Error(`Print page responded with ${response ? response.status() : "no response"}`);
    }

    // The template's webfonts load lazily (only the faces this CV uses) — wait for them so the PDF is set in the same type as the preview.
    await page.evaluate(() => document.fonts.ready);

    // What the print page actually rendered (its own read of the database), not what this function read a moment
    // earlier — so the caller can prove the PDF is the template and version the editor is showing.
    const rendered = await page.$eval("[data-cv-render]", (el) => ({
      template: el.getAttribute("data-template") ?? "",
      versionId: el.getAttribute("data-version-id") ?? "",
    }));
    if (!rendered.template || !rendered.versionId) throw new Error("The print page didn't say which template/version it rendered.");

    const buffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return { buffer: Buffer.from(buffer), title: data.cvTitle, ...rendered };
  } finally {
    await browser.close();
  }
}

/**
 * Which origin the headless browser loads the print page from — the
 * deployment that received the export request, so the PDF is drawn by the
 * same build (and reads the same database) as the preview the user is
 * looking at. It used to always use the configured production domain,
 * which on a preview/staging deployment is a *different* build with its
 * own template code. Only hosts we can vouch for are honoured (the
 * configured domain, localhost, *.vercel.app); anything else falls back to
 * the configured domain rather than sending the user's session cookies to
 * a host taken from a request header.
 */
export function resolveRenderOrigin(requestUrl: string | undefined): string {
  const configured = new URL(siteConfig.domain);
  if (!requestUrl) return configured.origin;
  try {
    const candidate = new URL(requestUrl);
    const host = candidate.hostname;
    const trusted =
      host === configured.hostname || host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app");
    return trusted ? candidate.origin : configured.origin;
  } catch {
    return configured.origin;
  }
}

const UNSAFE_FILENAME_CHARS = /["*/:<>?\\|]/g;

/** Strips characters that would break a Content-Disposition filename or a real filesystem, and bounds the length - keeps spaces/hyphens, a CV title should stay readable. */
export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(UNSAFE_FILENAME_CHARS, "").trim();
  const fallback = cleaned.length > 0 ? cleaned : "CV";
  return fallback.slice(0, 100);
}
