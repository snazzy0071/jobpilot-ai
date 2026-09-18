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
        Real print CSS, not a reuse of A4Page's on-screen JS pagination
        (see TemplateRenderer's `mode="print"` doc comment) — Chromium's
        own print engine paginates this for real, using `@page` for the
        real A4 size/margins and the `break-inside`/`break-after`
        utilities already on the content blocks (harmless on screen,
        meaningful here) to avoid splitting an entry mid-way across a
        page. `.pdf-export .font-*` overrides this project's on-screen
        heading font choices (which include a custom loaded webfont,
        Geist) with genuinely standard, universally-embeddable fonts —
        this task's explicit "standard fonts" requirement is about the
        exported document specifically, not a request to change the
        live web preview's typography.
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
      <h1 className="sr-only">{data.personal?.fullName ? `${data.personal.fullName} CV` : data.cvTitle}</h1>
      <TemplateRenderer templateSlug={data.template} data={data} mode="print" />
    </>
  );
}
