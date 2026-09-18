import Link from "next/link";
import { ScanSearchIcon, SparklesIcon, LockIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listCvs, getCvEditorData, getLatestAtsScan, listRecentJobOptions } from "@/lib/cvs/queries";
import { checkUsageAllowed } from "@/lib/entitlements/service";
import { computeFormatIssues, buildCvPlainText } from "@/lib/cvs/ats-format-checks";
import { CvPicker } from "@/components/ats-scanner/cv-picker";
import { AtsScannerPanel } from "@/components/ats-scanner/ats-scanner-panel";
import { Badge } from "@/components/ui/badge";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

export const dynamic = "force-dynamic";

/**
 * reference/auth/ats-scanner.png — a dedicated ATS Scanner page: pick a
 * CV, paste or import a job description, get a real score. Everything
 * this renders already existed (runAtsScan, the format checker, the
 * URL importer, recent-job reuse) but only inside the CV editor's
 * embedded panel; this is the first page that surfaces it as its own
 * tool, matching `src/config/tools.ts`'s "ats" entry, which previously
 * pointed `appHref` at the CV list because no dedicated page existed.
 * CV selection is a `?cvId=` query param, not client state — picking a
 * card is a real navigation, so this stays a plain server component.
 */
export default async function AtsScannerPage({
  searchParams,
}: {
  searchParams: Promise<{ cvId?: string }>;
}) {
  const { cvId } = await searchParams;
  const user = await requireUser();

  const [cvs, usage] = await Promise.all([listCvs(user.id), checkUsageAllowed(user.id, "tailored_ats_scans_per_month")]);
  const activeCvs = cvs.filter((cv) => !cv.isArchived);

  const selected = cvId ? activeCvs.find((cv) => cv.id === cvId) : activeCvs[0];

  let panel = null;
  if (selected) {
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

      const [initialScan, recentJobOptions] = await Promise.all([
        getLatestAtsScan(user.id, editorData.versionId),
        listRecentJobOptions(user.id),
      ]);

      panel = (
        <AtsScannerPanel
          cvId={editorData.cvId}
          versionId={editorData.versionId}
          cvTitle={editorData.cvTitle}
          cvText={buildCvPlainText(templateData)}
          formatIssues={computeFormatIssues(templateData)}
          initialScan={initialScan}
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

      {activeCvs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            You need a CV first —{" "}
            <Link href="/dashboard/cvs" className="font-medium text-foreground hover:underline">
              create one
            </Link>{" "}
            to run a scan.
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
