"use client";

import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { buildCvPlainText } from "@/lib/cvs/ats-format-checks";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { CvSkill, CvProject, CvCertification, CvLanguage, CvCustomSection, SectionKey } from "@/lib/cvs/types";

/**
 * reference/auth/create-cv.png's "What the ATS reads" preview mode —
 * the exact plain-text an ATS parser would extract, built with the same
 * `buildCvPlainText` the real ATS scan already scores against
 * (src/lib/cvs/ats-format-checks.ts), not a second, separately-written
 * approximation. Reads the same live `CvPreviewProvider` context as the
 * recruiter-view `CvPreview`, so it updates as you type too.
 */
export function CvAtsTextPreview({
  sectionOrder,
  skills = [],
  projects = [],
  certifications = [],
  languages = [],
  customSections = [],
}: {
  sectionOrder: SectionKey[];
  skills?: CvSkill[];
  projects?: CvProject[];
  certifications?: CvCertification[];
  languages?: CvLanguage[];
  customSections?: CvCustomSection[];
}) {
  const { preview } = useCvPreview();

  const data: CvTemplateContentData = {
    personal: preview.personal,
    summary: preview.summary,
    experience: preview.experience,
    education: preview.education,
    skills,
    projects,
    certifications,
    languages,
    customSections,
    sectionOrder,
  };

  const text = buildCvPlainText(data);

  return (
    <pre className="max-h-[80vh] overflow-auto rounded-b-xl bg-muted/30 p-6 font-mono text-xs whitespace-pre-wrap text-foreground">
      {text || "Nothing to read yet — start filling in your details."}
    </pre>
  );
}
