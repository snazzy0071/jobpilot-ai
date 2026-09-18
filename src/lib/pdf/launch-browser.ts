import "server-only";
import type { Browser } from "puppeteer-core";

/**
 * The one place a headless browser gets launched, for all three PDF
 * export paths (CVs, cover letters, Quick Scan reports) — was three
 * independent `puppeteer.launch({ headless: true })` call sites before
 * this, each importing plain `puppeteer` directly.
 *
 * Plain `puppeteer` bundles its own full Chromium download (~200MB+
 * uncompressed) — reliably over Vercel's serverless function size
 * limit, and a real, otherwise-silent deploy-time failure for every one
 * of these three routes. `@sparticuz/chromium` ships a serverless-
 * optimized, Brotli-compressed build (~35MB packed, decompressed to
 * `/tmp` at cold start) built specifically for this — but its binary is
 * Linux-only (confirmed in its own README), so it can't run on a
 * Windows/Mac dev machine. `VERCEL` is set automatically on every real
 * Vercel deployment (and by `vercel dev`) — nowhere else — which is
 * what picks the branch: the serverless-optimized path in
 * production/preview, plain `puppeteer` (which downloads its own
 * cross-platform Chromium) everywhere else, including local dev and
 * this project's own CI if it ever runs outside Vercel.
 *
 * `@sparticuz/chromium` must be excluded from bundling
 * (next.config.ts's `serverExternalPackages`) — its own README is
 * explicit that it relies on relative path resolution to find its
 * binary files, which breaks under webpack/Turbopack bundling.
 *
 * NOT verified against a real Vercel deployment — this sandbox has no
 * Vercel access. The shape here matches @sparticuz/chromium's own
 * documented usage exactly (including `headless: "shell"`, since that
 * package's FAQ says it doesn't support the newer headless mode), but
 * treat the first real deploy as the actual verification, not this.
 */
export async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const [{ default: chromium }, puppeteerCore] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return puppeteerCore.launch({
      args: await puppeteerCore.defaultArgs({ args: chromium.args, headless: "shell" }),
      executablePath: await chromium.executablePath(),
      headless: "shell",
    });
  }

  const { default: puppeteer } = await import("puppeteer");
  // puppeteer bundles its own nested puppeteer-core (a different install
  // than the top-level puppeteer-core above) — same Browser API, but TS
  // treats the two classes' private fields as nominally distinct, so a
  // structural cast is needed here even though both really are
  // puppeteer-core Browsers at runtime.
  return puppeteer.launch({ headless: true }) as unknown as Promise<Browser>;
}
