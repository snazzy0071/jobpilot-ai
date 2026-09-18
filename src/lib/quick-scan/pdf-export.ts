import "server-only";
import { siteConfig } from "@/config/site";
import { getQuickScanResultByToken } from "@/lib/quick-scan/results";
import { launchBrowser } from "@/lib/pdf/launch-browser";

/**
 * Same real-headless-Chromium pattern as CV export
 * (src/lib/cvs/pdf-export.ts's doc comment explains why: genuine
 * embedded/selectable text via `page.pdf()`, never a rasterized
 * screenshot) — navigates to `/print/quick-scan/[token]`, which does its
 * own token lookup server-side, so there's no session/cookie to forward
 * here the way the authenticated CV export needs. The token itself,
 * unguessable and hashed at rest (src/lib/quick-scan/results.ts), is
 * the only access control.
 */
export async function generateQuickScanPdf(token: string): Promise<Buffer | null> {
  const existing = await getQuickScanResultByToken(token);
  if (!existing) return null;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const response = await page.goto(`${siteConfig.domain}/print/quick-scan/${token}`, { waitUntil: "networkidle0" });
    if (!response || !response.ok()) {
      throw new Error(`Print page responded with ${response ? response.status() : "no response"}`);
    }
    const buffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(buffer);
  } finally {
    await browser.close();
  }
}
