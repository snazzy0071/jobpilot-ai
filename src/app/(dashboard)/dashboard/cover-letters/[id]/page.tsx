import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getCoverLetterEditorData, listCoverLetterVersions } from "@/lib/cover-letters/queries";
import { restoreCoverLetterVersion } from "@/lib/cover-letters/actions";
import { getCoverLetterTemplate } from "@/config/cover-letter-templates";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { VersionHistoryDialog } from "@/components/cvs/editor/version-history-dialog";
import { ParagraphSection } from "@/components/cover-letters/paragraph-section";
import { ToneLengthControls } from "@/components/cover-letters/tone-length-controls";
import { CopyLetterButton } from "@/components/cover-letters/copy-letter-button";
import { CoverLetterPreviewProvider } from "@/components/cover-letters/editor-preview-context";
import { CoverLetterPreview } from "@/components/cover-letters/cover-letter-preview";
import { CoverLetterTemplatePickerDialog } from "@/components/cover-letters/template-picker-dialog";
import { CoverLetterMobilePreviewTrigger } from "@/components/cover-letters/mobile-preview-trigger";

export const dynamic = "force-dynamic";

/**
 * The paragraph editor: autosave (ParagraphSection -> useAutosave),
 * per-paragraph Regenerate/Accept/Reject (AiRewritePanel, reused from
 * the CV editor), tone/length controls, version history, a live A4
 * preview across 4 original templates (CoverLetterPreviewProvider +
 * CoverLetterTemplateRenderer, mirroring the CV editor's own preview
 * pane), PDF export, and copy-as-text — all built from the same
 * components/patterns the CV editor already proved, pointed at the
 * cover_letter_* tables instead.
 */
export default async function CoverLetterEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const [data, versions] = await Promise.all([
    getCoverLetterEditorData(user.id, id),
    listCoverLetterVersions(user.id, id),
  ]);
  if (!data) notFound();

  const fullText = data.paragraphs.map((paragraph) => paragraph.content).join("\n\n");

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={
          <Link href="/dashboard/cover-letters">
            <ArrowLeftIcon /> All cover letters
          </Link>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {data.jobTitle} at {data.companyName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Version {data.versionNumber}</p>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Template</Label>
            <CoverLetterTemplatePickerDialog coverLetterId={data.coverLetterId} currentTemplate={data.template} />
            <p className="max-w-40 text-xs text-muted-foreground">{getCoverLetterTemplate(data.template).name}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Export</Label>
            {/* A plain download link, not a client fetch+blob — same
                reasoning as the CV editor's export button: the route
                already returns Content-Disposition: attachment. */}
            <Button
              size="sm"
              variant="outline"
              render={<a href={`/api/cover-letters/${data.coverLetterId}/export`} target="_blank" rel="noopener noreferrer" />}
            >
              <DownloadIcon /> Export PDF
            </Button>
          </div>

          <VersionHistoryDialog
            versions={versions}
            restore={restoreCoverLetterVersion}
            containerIdField="coverLetterId"
            containerId={data.coverLetterId}
          />
        </div>
      </div>

      <CoverLetterPreviewProvider
        initial={{
          template: data.template,
          senderName: data.senderName,
          senderEmail: data.senderEmail,
          senderPhone: data.senderPhone,
          senderLocation: data.senderLocation,
          companyName: data.companyName,
          jobTitle: data.jobTitle,
          paragraphs: data.paragraphs,
        }}
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex flex-col gap-6">
            <ToneLengthControls versionId={data.versionId} tone={data.tone} length={data.length} />
            <ParagraphSection versionId={data.versionId} paragraphs={data.paragraphs} />

            <div className="flex flex-wrap gap-2">
              <CopyLetterButton content={fullText} />
              <Button variant="outline" render={<Link href="/dashboard/cover-letters/new">Generate another</Link>} />
            </div>
          </div>

          {/* Desktop split-view — hidden below lg: a second column
              doesn't fit at phone widths, and CoverLetterMobilePreviewTrigger
              below is the usable mobile equivalent (see the CV editor's
              own MobilePreviewTrigger, same reasoning). */}
          <div className="hidden lg:sticky lg:top-6 lg:block">
            <CoverLetterPreview />
          </div>
        </div>

        <div className="lg:hidden">
          <CoverLetterMobilePreviewTrigger />
        </div>
      </CoverLetterPreviewProvider>
    </div>
  );
}
