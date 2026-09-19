"use client";

import { DownloadIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExportPdfButton } from "@/components/cvs/editor/export-pdf-button";
import { CvPreview } from "@/components/cvs/editor/cv-preview";
import { CvAtsTextPreview } from "@/components/cvs/editor/cv-ats-text-preview";
import type { CvSkill, CvProject, CvCertification, CvLanguage, CvCustomSection, SectionKey } from "@/lib/cvs/types";

type SharedPreviewProps = {
  sectionOrder: SectionKey[];
  skills: CvSkill[];
  projects: CvProject[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  customSections: CvCustomSection[];
};

/**
 * reference/auth/create-cv.png's "Recruiter view / What the ATS reads /
 * PDF" toggle above the live preview. The first two are real, both
 * driven by the same live-typing preview context (CvPreview,
 * CvAtsTextPreview). "PDF" doesn't inline-embed the actual exported
 * file — the export route serves it as a download
 * (Content-Disposition: attachment, by design, see editor-header.tsx),
 * and changing that to support inline viewing is a backend change this
 * task doesn't touch — so this tab honestly points at the same real
 * export action instead of faking an inline PDF viewer.
 */
export function CvPreviewTabs({ cvId, ...previewProps }: { cvId: string } & SharedPreviewProps) {
  return (
    <Tabs defaultValue="recruiter">
      <TabsList>
        <TabsTrigger value="recruiter">Recruiter view</TabsTrigger>
        <TabsTrigger value="ats">What the ATS reads</TabsTrigger>
        <TabsTrigger value="pdf">PDF</TabsTrigger>
      </TabsList>

      <TabsContent value="recruiter" className="mt-3">
        <CvPreview {...previewProps} />
      </TabsContent>

      <TabsContent value="ats" className="mt-3">
        <CvAtsTextPreview {...previewProps} />
      </TabsContent>

      <TabsContent value="pdf" className="mt-3">
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
          <DownloadIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Export renders your CV as a real, ATS-safe PDF — the exact file you&apos;ll download.
          </p>
          <ExportPdfButton cvId={cvId} variant="default" label="Export PDF" />
        </div>
      </TabsContent>
    </Tabs>
  );
}
