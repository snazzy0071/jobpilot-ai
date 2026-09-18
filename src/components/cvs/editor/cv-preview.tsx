"use client";

import { useCvPreview } from "@/components/cvs/editor/preview-context";
import { TemplateRenderer } from "@/components/cvs/templates/template-renderer";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import type { CvSkill, CvProject, CvCertification, CvLanguage, CvCustomSection, SectionKey } from "@/lib/cvs/types";

/**
 * The editor's live preview panel — a thin adapter over the template
 * engine (`src/components/cvs/templates/`). Personal/Summary/Experience/
 * Education, and now the template choice itself, come from
 * CvPreviewProvider's merged `preview` value, so a keystroke or a
 * template-picker selection shows up immediately, before any save
 * completes. Skills/Projects/Certifications/Languages/custom sections
 * are passed in directly instead — they use the plain
 * autosave-then-revalidate model (not the live-typing overlay), so the
 * preview reflects them as of the last save, same as the rest of the
 * editor.
 */
export function CvPreview({
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

  return <TemplateRenderer templateSlug={preview.template} data={data} />;
}
