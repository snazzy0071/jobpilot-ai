import type {
  CvPersonal,
  CvSummary,
  CvExperience,
  CvEducation,
  CvSkill,
  CvProject,
  CvCertification,
  CvLanguage,
  CvCustomSection,
  SectionKey,
} from "@/lib/cvs/types";

/**
 * Plain data every template layout renders from — decoupled from
 * `CvPreviewProvider`'s live-typing context on purpose, so the template
 * engine itself has no dependency on the editor's autosave/live-preview
 * machinery and can also render a fixed sample CV for template-picker
 * thumbnails. `CvPreview` is the adapter that merges the live context
 * into this shape before handing it to `TemplateRenderer`.
 */
export type CvTemplateContentData = {
  personal: CvPersonal | null;
  summary: CvSummary | null;
  experience: CvExperience[];
  education: CvEducation[];
  skills: CvSkill[];
  projects: CvProject[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  customSections: CvCustomSection[];
  sectionOrder: SectionKey[];
};

/** The parts of a CV that don't change while typing in the live-preview forms — passed alongside the live context to build a full preview. */
export type CvTemplateExtras = Pick<
  CvTemplateContentData,
  "skills" | "projects" | "certifications" | "languages" | "customSections" | "sectionOrder"
>;
