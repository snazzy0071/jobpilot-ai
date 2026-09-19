import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCvEditorData } from "@/lib/cvs/queries";
import { TemplateRenderer } from "@/components/cvs/templates/template-renderer";

// Deliberately outside the (dashboard) route group — this page must
// render as *only* the CV itself (no sidebar, header, or any other app
// chrome), since it exists purely for Puppeteer to capture as a PDF
// (src/app/api/cvs/[cvId]/export/route.ts). It still requires the same
// real auth + ownership check as the editor (`requireUser` +
// `getCvEditorData`, which already scopes to the caller via RLS and an
// explicit `user_id` filter) — reachable by a human in a browser too,
// but never by anyone who doesn't own the CV.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ cvId: string }> }): Promise<Metadata> {
  const { cvId } = await params;
  const user = await requireUser();
  const data = await getCvEditorData(user.id, cvId);
  return {
    title: data ? (data.personal?.fullName ? `${data.personal.fullName} CV` : data.cvTitle) : "CV",
    robots: { index: false, follow: false },
  };
}

export default async function CvPrintPage({ params }: { params: Promise<{ cvId: string }> }) {
  const { cvId } = await params;
  const user = await requireUser();
  const data = await getCvEditorData(user.id, cvId);
  if (!data) notFound();

  return (
    <>
      {/*
        Real print CSS, not a reuse of A4Page's on-screen slicing (see
        TemplateRenderer's `mode="print"` doc comment) — Chromium's own
        print engine paginates this for real. `@page` has *no* margin on
        purpose: each template draws its own page edge (full-bleed
        banners, sidebar columns), and the document wrapper re-applies
        its top/bottom padding to every page it flows onto via
        `box-decoration-break: clone`. Content blocks are
        `break-inside: avoid` (data-cv-atom in the markup), the same
        rules the on-screen paginator (a4-page.tsx) uses to place its
        page breaks. The fonts are the template's own — self-hosted by
        next/font, so the preview and this document set text in the
        same typefaces; Chromium embeds them as real, extractable text.
      */}
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { background: #fff; margin: 0; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        [data-cv-atom] { break-inside: avoid; }
        [data-cv-keep] { break-after: avoid; }
      `}</style>
      {/* sr-only real <h1> — this route had zero headings; harmless for
          Puppeteer's PDF capture (invisible, zero layout impact) and
          gives the rare human visitor and any AT a real page title. */}
      <h1 className="sr-only">{data.personal?.fullName ? `${data.personal.fullName} CV` : data.cvTitle}</h1>
      {/* Read back by generateCvPdf so the export can report exactly which template and version it rendered. */}
      <div data-cv-render data-template={data.template} data-version-id={data.versionId}>
        <TemplateRenderer templateSlug={data.template} data={data} mode="print" />
      </div>
    </>
  );
}
