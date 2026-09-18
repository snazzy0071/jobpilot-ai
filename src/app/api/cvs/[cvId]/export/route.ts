import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { generateCvPdf, sanitizeFilename } from "@/lib/cvs/pdf-export";

export const dynamic = "force-dynamic";
// Headless-browser launch + page render is well under this on a warm
// start, but a cold Chromium extract (src/lib/pdf/launch-browser.ts)
// plus a slow print-page render can add real time — 60s leaves margin
// while staying well inside Vercel's 300s default/Hobby-plan ceiling.
export const maxDuration = 60;

/**
 * Server-generated CV PDF export. Ownership isn't re-checked here as a
 * separate step - `generateCvPdf` calls `getCvEditorData(userId, cvId)`,
 * the same RLS + explicit-`user_id`-scoped query every other read in
 * src/lib/cvs/ uses, and the headless browser it drives loads
 * `/print/cvs/[cvId]` under that *same* user's forwarded session, which
 * runs the identical check again. Not plan-gated: creating/editing a CV
 * isn't gated by any FeatureKey/MeteredKey beyond `cv_limit` (how many
 * CVs can exist at once), and exporting one you already own isn't a
 * new capability beyond that - there's no existing entitlement key this
 * naturally extends, and inventing one wasn't part of what was asked.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ cvId: string }> }) {
  const { cvId } = await params;
  const user = await requireUser();

  const cookieStore = await cookies();
  const forwardedCookies = cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value }));

  let result;
  try {
    result = await generateCvPdf(user.id, cvId, forwardedCookies);
  } catch (err) {
    console.error(`CV PDF export failed for cv ${cvId}:`, err);
    return NextResponse.json({ error: "Couldn't generate that PDF - try again." }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "That CV couldn't be found." }, { status: 404 });
  }

  const filename = sanitizeFilename(result.title);

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Content-Length": String(result.buffer.length),
    },
  });
}
