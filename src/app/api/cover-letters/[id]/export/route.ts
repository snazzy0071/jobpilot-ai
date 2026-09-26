import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/ai/rate-limit";
import { generateCoverLetterPdf } from "@/lib/cover-letters/pdf-export";
import { sanitizeFilename } from "@/lib/cvs/pdf-export";

export const dynamic = "force-dynamic";
// Same headless-browser budget as the CV export route.
export const maxDuration = 60;

/**
 * Server-generated cover letter PDF export — same shape as
 * src/app/api/cvs/[cvId]/export/route.ts. Ownership isn't re-checked
 * here as a separate step: generateCoverLetterPdf calls
 * getCoverLetterEditorData(userId, id), the same RLS + explicit
 * user_id-scoped query every other read in src/lib/cover-letters/ uses,
 * and the headless browser it drives loads /print/cover-letters/[id]
 * under that same user's forwarded session, which runs the identical
 * check again.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  // Each export launches a headless browser: cap how fast one account can start them.
  if (!(await consumeRateLimit(user.id, "cover_letter_export")).allowed) {
    return NextResponse.json({ error: "You're exporting too quickly — wait a moment and try again." }, { status: 429 });
  }

  const cookieStore = await cookies();
  const forwardedCookies = cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value }));

  let result;
  try {
    result = await generateCoverLetterPdf(user.id, id, forwardedCookies);
  } catch (err) {
    console.error(`Cover letter PDF export failed for id ${id}:`, err);
    return NextResponse.json({ error: "Couldn't generate that PDF — try again." }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "That cover letter couldn't be found." }, { status: 404 });
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
