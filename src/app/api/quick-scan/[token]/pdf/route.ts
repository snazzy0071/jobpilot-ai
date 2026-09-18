import { NextResponse } from "next/server";
import { generateQuickScanPdf } from "@/lib/quick-scan/pdf-export";
import { consumeQuickScanPdfRateLimit } from "@/lib/quick-scan/rate-limit";

export const dynamic = "force-dynamic";
// Same headless-browser budget as the CV export route.
export const maxDuration = 60;

/**
 * Anonymous PDF download for a Quick Scan result — no `requireUser()`
 * here on purpose, the same way the result page itself has none: the
 * token in the URL (unguessable, hashed at rest) is the only access
 * control there is, since there's no account to check ownership
 * against. `consumeQuickScanPdfRateLimit` is a secondary guard against
 * repeatedly spinning up headless Chromium against a known-valid token,
 * not a substitute for the token's own unguessability.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const allowed = await consumeQuickScanPdfRateLimit();
  if (!allowed) {
    return NextResponse.json({ error: "Too many PDF downloads from this connection — try again shortly." }, { status: 429 });
  }

  let buffer: Buffer | null;
  try {
    buffer = await generateQuickScanPdf(token);
  } catch (err) {
    console.error(`Quick Scan PDF export failed for token ${token.slice(0, 8)}…:`, err);
    return NextResponse.json({ error: "Couldn't generate that PDF — try again." }, { status: 500 });
  }

  if (!buffer) {
    return NextResponse.json({ error: "That result couldn't be found — it may have expired." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ats-scan-report.pdf"`,
      "Content-Length": String(buffer.length),
    },
  });
}
