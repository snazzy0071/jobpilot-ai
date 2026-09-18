import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCoverLetterEditorData } from "@/lib/cover-letters/queries";
import { CoverLetterTemplateRenderer } from "@/components/cover-letters/templates/template-renderer";

// Deliberately outside every route group — this page must render as
// *only* the letter itself (no sidebar, header, or app chrome), since
// it exists purely for Puppeteer to capture as a PDF
// (src/lib/cover-letters/pdf-export.ts). Same real auth + ownership
// check as the editor (requireUser + getCoverLetterEditorData, already
// scoped to the caller via RLS and an explicit user_id filter) —
// reachable by a human in a browser too, but never by anyone who
// doesn't own the letter.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const data = await getCoverLetterEditorData(user.id, id);
  return {
    title: data ? `${data.jobTitle} at ${data.companyName}` : "Cover letter",
    robots: { index: false, follow: false },
  };
}

export default async function CoverLetterPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const data = await getCoverLetterEditorData(user.id, id);
  if (!data) notFound();

  return (
    <>
      {/*
        Same font-override convention as /print/cvs/[cvId]: Chromium's
        real print engine paginates this via @page, and .pdf-export
        .font-serif/.font-sans replace this project's on-screen webfont
        (Geist) with genuinely standard, universally-embeddable fonts —
        matched by CoverLetterTemplateRenderer's mode="print" wrapper,
        which carries the .pdf-export class these selectors target.
      */}
      <style>{`
        @page { size: A4; margin: 14mm 16mm; }
        html, body { background: #fff; margin: 0; }
        .pdf-export { font-family: Arial, Helvetica, sans-serif; }
        .pdf-export .font-serif { font-family: Georgia, "Times New Roman", Times, serif; }
        .pdf-export .font-sans { font-family: Arial, Helvetica, sans-serif; }
      `}</style>
      {/* sr-only real <h1> — this route had zero headings; harmless for
          Puppeteer's PDF capture (invisible, zero layout impact) and
          gives the rare human visitor and any AT a real page title. */}
      <h1 className="sr-only">{`${data.jobTitle} at ${data.companyName}`}</h1>
      <CoverLetterTemplateRenderer templateSlug={data.template} data={data} mode="print" />
    </>
  );
}
