import Link from "next/link";
import { ScanSearchIcon, SparklesIcon, LockIcon, UploadIcon, FolderIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listCvs, getCvEditorData, listAtsScanHistory, listRecentJobOptions } from "@/lib/cvs/queries";
import { checkUsageAllowed } from "@/lib/entitlements/service";
import { computeFormatIssues, buildCvPlainText } from "@/lib/cvs/ats-format-checks";
import { CvPicker } from "@/components/ats-scanner/cv-picker";
import { AtsScannerPanel } from "@/components/ats-scanner/ats-scanner-panel";
import { ManualScanPanel } from "@/components/ats-scanner/manual-scan-panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

export const dynamic = "force-dynamic";

/**
 * reference/auth/ats-scanner.png — a dedicated ATS Scanner page. Two
 * real entry points, matching the reference's own "upload CV + paste
 * job description" scan form: `?mode=saved` (the default) picks one of
 * your saved CVs and scores its live content; `?mode=upload` scores a
 * PDF/DOCX/text file (or pasted text) you didn't have to build in the
 * CV editor first (`ManualScanPanel`/`runManualAtsScan`). Both spend
 * the same `tailored_ats_scans_per_month` allowance and write to the
 * same `ats_scans` table (migration 0031's `source` column is exactly
 * what tells the two apart), so the usage badge above covers both.
 *
 * The mode toggle and CV selection are both plain `?query=` links, not
 * client state — matching `CvPicker`'s own reasoning: picking one is a
 * real navigation, so this whole page stays a server component.
 */
export default async function AtsScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ cvId?: string; mode?: string }>;
}) {
  const { cvId, mode: modeParam } = await searchParams;
  const mode = modeParam === "upload" ? "upload" : "saved";
  const user = await requireUser();

  const [cvs, usage, recentJobOptions] = await Promise.all([
    listCvs(user.id),
    checkUsageAllowed(user.id, "tailored_ats_scans_per_month"),
    listRecentJobOptions(user.id),
  ]);
  const activeCvs = cvs.filter((cv) => !cv.isArchived);

  const selected = cvId ? activeCvs.find((cv) => cv.id === cvId) : activeCvs[0];

  let panel = null;
  if (mode === "saved" && selected) {
    const editorData = await getCvEditorData(user.id, selected.id);
    if (editorData) {
      const templateData: CvTemplateContentData = {
        personal: editorData.personal,
        summary: editorData.summary,
        experience: editorData.experience,
        education: editorData.education,
        skills: editorData.skills,
        projects: editorData.projects,
        certifications: editorData.certifications,
        languages: editorData.languages,
        customSections: editorData.customSections,
        sectionOrder: editorData.sectionOrder,
      };

      const history = await listAtsScanHistory(user.id, editorData.versionId);

      panel = (
        <AtsScannerPanel
          cvId={editorData.cvId}
          versionId={editorData.versionId}
          cvTitle={editorData.cvTitle}
          cvText={buildCvPlainText(templateData)}
          formatIssues={computeFormatIssues(templateData)}
          history={history}
          recentJobOptions={recentJobOptions}
        />
      );
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScanSearchIcon className="size-6" />
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">ATS Scanner</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">See your CV the way a filter does</h1>
            <p className="mt-1 max-w-2xl text-muted-foreground">
              Score a CV against a real job description and see exactly which keywords and structure issues would
              hold it back — before a recruiter ever opens the file.
            </p>
          </div>
        </div>

        {usage.limit === null ? (
          <Badge variant="tinted" className="gap-1.5">
            <SparklesIcon className="size-3.5" /> Unlimited on your plan
          </Badge>
        ) : usage.remaining && usage.remaining > 0 ? (
          <Badge variant="tinted" className="gap-1.5">
            <SparklesIcon className="size-3.5" /> {usage.remaining} of {usage.limit} scans left this month
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1.5" render={<Link href="/pricing" />}>
            <LockIcon className="size-3.5" /> Upgrade for tailored scans
          </Badge>
        )}
      </div>

      <div role="tablist" aria-label="Which CV to scan" className="inline-flex w-fit gap-1 rounded-lg border bg-muted/40 p-1">
        <Link
          href="/dashboard/ats-scanner?mode=saved"
          prefetch={false}
          role="tab"
          aria-selected={mode === "saved"}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "saved" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <FolderIcon className="size-3.5" /> A saved CV
        </Link>
        <Link
          href="/dashboard/ats-scanner?mode=upload"
          prefetch={false}
          role="tab"
          aria-selected={mode === "upload"}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "upload" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <UploadIcon className="size-3.5" /> Upload a file
        </Link>
      </div>

      {mode === "upload" ? (
        <ManualScanPanel recentJobOptions={recentJobOptions} />
      ) : activeCvs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            You need a CV first —{" "}
            <Link href="/dashboard/cvs" className="font-medium text-foreground hover:underline">
              create one
            </Link>{" "}
            — or{" "}
            <Link href="/dashboard/ats-scanner?mode=upload" className="font-medium text-foreground hover:underline">
              upload a file
            </Link>{" "}
            to scan instead.
          </p>
        </div>
      ) : (
        <>
          <CvPicker cvs={activeCvs} selectedCvId={selected?.id ?? null} />
          {panel}
        </>
      )}
    </div>
  );
}
