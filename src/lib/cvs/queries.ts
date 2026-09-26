import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CvListItem,
  CvTemplate,
  CvEditorData,
  CvPersonal,
  CvSummary,
  CvExperience,
  CvEducation,
  CvSkill,
  CvProject,
  CvCertification,
  CvLanguage,
  CvCustomSection,
  CvVersionSummary,
  CvAtsScan,
  CvAtsJobOption,
  CvAtsFixPriority,
  SectionKey,
  LanguageProficiency,
} from "@/lib/cvs/types";
import { normalizeCvTemplate } from "@/config/cv-templates";
import { SECTION_KEYS } from "@/lib/cvs/types";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";

type CvListVersionRow = { id: string; ats_score: number | null; is_current: boolean };

type CvListRow = {
  id: string;
  title: string;
  template: CvTemplate;
  is_archived: boolean;
  updated_at: string;
  cv_versions: CvListVersionRow[] | null;
};

/**
 * Every query here relies on RLS (the caller's own session client from
 * `createClient()`, never the admin client) to scope results to the
 * signed-in user — the same ownership boundary migration 0024's `for
 * all` policies enforce at the database level, not just filtered for in
 * application code.
 */
export async function listCvs(userId: string): Promise<CvListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cvs")
    .select("id, title, template, is_archived, updated_at, cv_versions(id, ats_score, is_current)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("listCvs failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as CvListRow[]).map((row) => {
    const current = (row.cv_versions ?? []).find((v) => v.is_current) ?? null;
    return {
      id: row.id,
      title: row.title,
      template: normalizeCvTemplate(row.template),
      isArchived: row.is_archived,
      updatedAt: row.updated_at,
      currentVersionId: current?.id ?? null,
      atsScore: current?.ats_score ?? null,
    };
  });
}

export type CvListItemWithPreview = CvListItem & { previewData: CvTemplateContentData | null };

/**
 * `listCvs` plus each CV's real current-version content, shaped for
 * `TemplateRenderer` — the CV list's card thumbnails render the user's
 * actual saved CV in miniature, not a fabricated placeholder image.
 * Reuses `getCvEditorData` per CV rather than a new hand-rolled join:
 * one extra `cvs`/`cv_versions` round trip per card, but it means the
 * thumbnail can never drift from what the editor and PDF export
 * themselves would render for that same version.
 */
export async function listCvsWithPreview(userId: string): Promise<CvListItemWithPreview[]> {
  const items = await listCvs(userId);
  const versionIds = items.map((item) => item.currentVersionId).filter((id): id is string => id !== null);
  if (versionIds.length === 0) return items.map((item) => ({ ...item, previewData: null }));

  const supabase = await createClient();
  const [sectionOrders, sectionsByVersion] = await Promise.all([
    supabase.from("cv_versions").select("id, section_order").in("id", versionIds),
    getVersionSectionsBatch(versionIds),
  ]);

  const sectionOrderByVersion = new Map(
    ((sectionOrders.data ?? []) as { id: string; section_order: unknown }[]).map((row) => [
      row.id,
      parseSectionOrder(row.section_order),
    ]),
  );

  return items.map((item) => {
    if (!item.currentVersionId) return { ...item, previewData: null };
    const sections = sectionsByVersion.get(item.currentVersionId);
    if (!sections) return { ...item, previewData: null };
    const previewData: CvTemplateContentData = {
      ...sections,
      sectionOrder: sectionOrderByVersion.get(item.currentVersionId) ?? [...SECTION_KEYS],
    };
    return { ...item, previewData };
  });
}

/** All versions of a cv, newest first — the raw material for the version-history panel. */
export async function listCvVersions(userId: string, cvId: string): Promise<CvVersionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cv_versions")
    .select("id, version_number, label, is_current, created_at")
    .eq("cv_id", cvId)
    .eq("user_id", userId)
    .order("version_number", { ascending: false });

  if (error) {
    console.error("listCvVersions failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    versionNumber: row.version_number,
    label: row.label,
    isCurrent: row.is_current,
    createdAt: row.created_at,
  }));
}

type PersonalRow = {
  id: string;
  full_name: string;
  headline: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
};

type SummaryRow = { id: string; content: string };

type ExperienceRow = {
  id: string;
  job_title: string;
  employer: string;
  location: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  display_order: number;
};

type EducationRow = {
  id: string;
  institution: string;
  qualification: string;
  field_of_study: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  grade: string | null;
  description: string | null;
  display_order: number;
};

type SkillRow = { id: string; name: string; category: string | null; display_order: number; is_visible: boolean };

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  technologies: string[] | null;
  start_date: string | null;
  end_date: string | null;
  is_ongoing: boolean;
  display_order: number;
  is_visible: boolean;
};

type CertificationRow = {
  id: string;
  name: string;
  issuing_organization: string;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  credential_url: string | null;
  display_order: number;
  is_visible: boolean;
};

type LanguageRow = {
  id: string;
  name: string;
  proficiency: LanguageProficiency;
  display_order: number;
  is_visible: boolean;
};

type CustomSectionRow = {
  id: string;
  title: string;
  content: string | null;
  display_order: number;
  is_visible: boolean;
};

export type VersionSections = {
  personal: CvPersonal | null;
  summary: CvSummary | null;
  experience: CvExperience[];
  education: CvEducation[];
  skills: CvSkill[];
  projects: CvProject[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  customSections: CvCustomSection[];
};

/**
 * Every section table's content for one specific version, in one round
 * trip per table — the shared fetch behind both `getCvEditorData`
 * (always the *current* version of a cv) and the history-snapshot/
 * restore machinery in actions.ts (an arbitrary, possibly non-current
 * version by id). Ownership is enforced by the caller resolving
 * `versionId` through a query already scoped to `userId` first; this
 * function trusts the id it's given, same as every write path that
 * calls `assertOwnsVersion` before reaching here.
 */
export async function getVersionSections(versionId: string): Promise<VersionSections> {
  const supabase = await createClient();

  const [
    personalRes,
    summaryRes,
    experienceRes,
    educationRes,
    skillsRes,
    projectsRes,
    certificationsRes,
    languagesRes,
    customSectionsRes,
  ] = await Promise.all([
    supabase
      .from("cv_personal")
      .select("id, full_name, headline, email, phone, location, website_url, linkedin_url, portfolio_url")
      .eq("cv_version_id", versionId)
      .maybeSingle(),
    supabase.from("cv_summary").select("id, content").eq("cv_version_id", versionId).maybeSingle(),
    supabase
      .from("cv_experience")
      .select("id, job_title, employer, location, start_date, end_date, is_current, description, display_order")
      .eq("cv_version_id", versionId)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_education")
      .select(
        "id, institution, qualification, field_of_study, location, start_date, end_date, is_current, grade, description, display_order",
      )
      .eq("cv_version_id", versionId)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_skills")
      .select("id, name, category, display_order, is_visible")
      .eq("cv_version_id", versionId)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_projects")
      .select("id, name, description, url, technologies, start_date, end_date, is_ongoing, display_order, is_visible")
      .eq("cv_version_id", versionId)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_certifications")
      .select(
        "id, name, issuing_organization, issue_date, expiry_date, credential_id, credential_url, display_order, is_visible",
      )
      .eq("cv_version_id", versionId)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_languages")
      .select("id, name, proficiency, display_order, is_visible")
      .eq("cv_version_id", versionId)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_custom_sections")
      .select("id, title, content, display_order, is_visible")
      .eq("cv_version_id", versionId)
      .order("display_order", { ascending: true }),
  ]);

  const personalRow = personalRes.data as PersonalRow | null;
  const summaryRow = summaryRes.data as SummaryRow | null;

  const personal: CvPersonal | null = personalRow
    ? {
        id: personalRow.id,
        fullName: personalRow.full_name,
        headline: personalRow.headline,
        email: personalRow.email,
        phone: personalRow.phone,
        location: personalRow.location,
        websiteUrl: personalRow.website_url,
        linkedinUrl: personalRow.linkedin_url,
        portfolioUrl: personalRow.portfolio_url,
      }
    : null;

  const summary: CvSummary | null = summaryRow ? { id: summaryRow.id, content: summaryRow.content } : null;

  const experience: CvExperience[] = ((experienceRes.data ?? []) as ExperienceRow[]).map((row) => ({
    id: row.id,
    jobTitle: row.job_title,
    employer: row.employer,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    description: row.description,
    displayOrder: row.display_order,
  }));

  const education: CvEducation[] = ((educationRes.data ?? []) as EducationRow[]).map((row) => ({
    id: row.id,
    institution: row.institution,
    qualification: row.qualification,
    fieldOfStudy: row.field_of_study,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    grade: row.grade,
    description: row.description,
    displayOrder: row.display_order,
  }));

  const skills: CvSkill[] = ((skillsRes.data ?? []) as SkillRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
  }));

  const projects: CvProject[] = ((projectsRes.data ?? []) as ProjectRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    url: row.url,
    technologies: row.technologies ?? [],
    startDate: row.start_date,
    endDate: row.end_date,
    isOngoing: row.is_ongoing,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
  }));

  const certifications: CvCertification[] = ((certificationsRes.data ?? []) as CertificationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    issuingOrganization: row.issuing_organization,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    credentialId: row.credential_id,
    credentialUrl: row.credential_url,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
  }));

  const languages: CvLanguage[] = ((languagesRes.data ?? []) as LanguageRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    proficiency: row.proficiency,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
  }));

  const customSections: CvCustomSection[] = ((customSectionsRes.data ?? []) as CustomSectionRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    displayOrder: row.display_order,
    isVisible: row.is_visible,
  }));

  return { personal, summary, experience, education, skills, projects, certifications, languages, customSections };
}

/**
 * Same 9 section tables as `getVersionSections`, but for many versions
 * at once via `.in("cv_version_id", versionIds)` — still 9 round trips
 * total (parallel), not 9 *per version*. Exists purely for
 * `listCvsWithPreview`: calling `getVersionSections` once per CV card
 * turned a CV list page with N cards into roughly 3+9N round trips
 * (2 sequential lookups plus a 9-way parallel batch, per card); this
 * makes it 2 + 9 regardless of N. Returns a map keyed by version id so
 * the caller can look up each CV's own sections after the fact.
 */
export async function getVersionSectionsBatch(versionIds: string[]): Promise<Map<string, VersionSections>> {
  const empty = (): VersionSections => ({
    personal: null,
    summary: null,
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
    customSections: [],
  });

  const result = new Map<string, VersionSections>(versionIds.map((id) => [id, empty()]));
  if (versionIds.length === 0) return result;

  const supabase = await createClient();

  const [
    personalRes,
    summaryRes,
    experienceRes,
    educationRes,
    skillsRes,
    projectsRes,
    certificationsRes,
    languagesRes,
    customSectionsRes,
  ] = await Promise.all([
    supabase
      .from("cv_personal")
      .select("cv_version_id, id, full_name, headline, email, phone, location, website_url, linkedin_url, portfolio_url")
      .in("cv_version_id", versionIds),
    supabase.from("cv_summary").select("cv_version_id, id, content").in("cv_version_id", versionIds),
    supabase
      .from("cv_experience")
      .select("cv_version_id, id, job_title, employer, location, start_date, end_date, is_current, description, display_order")
      .in("cv_version_id", versionIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_education")
      .select(
        "cv_version_id, id, institution, qualification, field_of_study, location, start_date, end_date, is_current, grade, description, display_order",
      )
      .in("cv_version_id", versionIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_skills")
      .select("cv_version_id, id, name, category, display_order, is_visible")
      .in("cv_version_id", versionIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_projects")
      .select(
        "cv_version_id, id, name, description, url, technologies, start_date, end_date, is_ongoing, display_order, is_visible",
      )
      .in("cv_version_id", versionIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_certifications")
      .select(
        "cv_version_id, id, name, issuing_organization, issue_date, expiry_date, credential_id, credential_url, display_order, is_visible",
      )
      .in("cv_version_id", versionIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_languages")
      .select("cv_version_id, id, name, proficiency, display_order, is_visible")
      .in("cv_version_id", versionIds)
      .order("display_order", { ascending: true }),
    supabase
      .from("cv_custom_sections")
      .select("cv_version_id, id, title, content, display_order, is_visible")
      .in("cv_version_id", versionIds)
      .order("display_order", { ascending: true }),
  ]);

  for (const row of (personalRes.data ?? []) as (PersonalRow & { cv_version_id: string })[]) {
    const entry = result.get(row.cv_version_id);
    if (!entry) continue;
    entry.personal = {
      id: row.id,
      fullName: row.full_name,
      headline: row.headline,
      email: row.email,
      phone: row.phone,
      location: row.location,
      websiteUrl: row.website_url,
      linkedinUrl: row.linkedin_url,
      portfolioUrl: row.portfolio_url,
    };
  }

  for (const row of (summaryRes.data ?? []) as (SummaryRow & { cv_version_id: string })[]) {
    const entry = result.get(row.cv_version_id);
    if (entry) entry.summary = { id: row.id, content: row.content };
  }

  for (const row of (experienceRes.data ?? []) as (ExperienceRow & { cv_version_id: string })[]) {
    result.get(row.cv_version_id)?.experience.push({
      id: row.id,
      jobTitle: row.job_title,
      employer: row.employer,
      location: row.location,
      startDate: row.start_date,
      endDate: row.end_date,
      isCurrent: row.is_current,
      description: row.description,
      displayOrder: row.display_order,
    });
  }

  for (const row of (educationRes.data ?? []) as (EducationRow & { cv_version_id: string })[]) {
    result.get(row.cv_version_id)?.education.push({
      id: row.id,
      institution: row.institution,
      qualification: row.qualification,
      fieldOfStudy: row.field_of_study,
      location: row.location,
      startDate: row.start_date,
      endDate: row.end_date,
      isCurrent: row.is_current,
      grade: row.grade,
      description: row.description,
      displayOrder: row.display_order,
    });
  }

  for (const row of (skillsRes.data ?? []) as (SkillRow & { cv_version_id: string })[]) {
    result.get(row.cv_version_id)?.skills.push({
      id: row.id,
      name: row.name,
      category: row.category,
      displayOrder: row.display_order,
      isVisible: row.is_visible,
    });
  }

  for (const row of (projectsRes.data ?? []) as (ProjectRow & { cv_version_id: string })[]) {
    result.get(row.cv_version_id)?.projects.push({
      id: row.id,
      name: row.name,
      description: row.description,
      url: row.url,
      technologies: row.technologies ?? [],
      startDate: row.start_date,
      endDate: row.end_date,
      isOngoing: row.is_ongoing,
      displayOrder: row.display_order,
      isVisible: row.is_visible,
    });
  }

  for (const row of (certificationsRes.data ?? []) as (CertificationRow & { cv_version_id: string })[]) {
    result.get(row.cv_version_id)?.certifications.push({
      id: row.id,
      name: row.name,
      issuingOrganization: row.issuing_organization,
      issueDate: row.issue_date,
      expiryDate: row.expiry_date,
      credentialId: row.credential_id,
      credentialUrl: row.credential_url,
      displayOrder: row.display_order,
      isVisible: row.is_visible,
    });
  }

  for (const row of (languagesRes.data ?? []) as (LanguageRow & { cv_version_id: string })[]) {
    result.get(row.cv_version_id)?.languages.push({
      id: row.id,
      name: row.name,
      proficiency: row.proficiency,
      displayOrder: row.display_order,
      isVisible: row.is_visible,
    });
  }

  for (const row of (customSectionsRes.data ?? []) as (CustomSectionRow & { cv_version_id: string })[]) {
    result.get(row.cv_version_id)?.customSections.push({
      id: row.id,
      title: row.title,
      content: row.content,
      displayOrder: row.display_order,
      isVisible: row.is_visible,
    });
  }

  return result;
}

function parseSectionOrder(raw: unknown): SectionKey[] {
  const order = Array.isArray(raw) ? (raw as string[]).filter((key): key is SectionKey => SECTION_KEYS.includes(key as SectionKey)) : [];
  const missing = SECTION_KEYS.filter((key) => !order.includes(key));
  // A version predating this column, or one that somehow lost an entry,
  // still gets every section rendered — appended in the default order —
  // rather than silently dropping a section because its key isn't in a
  // possibly-stale array.
  return [...order, ...missing];
}

/**
 * Everything the CV editor needs for one CV's current version, in one
 * round trip per section table. Returns null if the cv doesn't exist or
 * isn't owned by `userId` (RLS already guarantees the latter; the
 * `.eq("user_id", userId)` calls below are defense in depth, matching
 * every write path in src/lib/cvs/actions.ts).
 */
export async function getCvEditorData(userId: string, cvId: string): Promise<CvEditorData | null> {
  const supabase = await createClient();

  const { data: cv, error: cvError } = await supabase
    .from("cvs")
    .select("id, title, template")
    .eq("id", cvId)
    .eq("user_id", userId)
    .maybeSingle();

  if (cvError || !cv) return null;

  const { data: version, error: versionError } = await supabase
    .from("cv_versions")
    .select("id, version_number, ats_score, section_order")
    .eq("cv_id", cvId)
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();

  if (versionError || !version) return null;

  const sections = await getVersionSections(version.id);

  return {
    cvId: cv.id,
    cvTitle: cv.title,
    template: normalizeCvTemplate(cv.template),
    versionId: version.id,
    versionNumber: version.version_number,
    atsScore: version.ats_score,
    sectionOrder: parseSectionOrder(version.section_order),
    ...sections,
  };
}

type AtsScanRow = {
  id: string;
  job_description: string;
  match_score: number;
  keyword_score: number;
  structure_score: number;
  format_score: number;
  sections_score: number;
  strengths: string[];
  summary: string;
  created_at: string;
  ats_keywords: {
    keyword: string;
    status: "matched" | "missing";
    importance: CvAtsFixPriority;
    occurrence_count: number;
    suggested_section: string | null;
  }[];
  ats_issues: { source: "format" | "ai"; priority: CvAtsFixPriority | null; section_key: string | null; message: string }[];
};

const ATS_SCAN_SELECT =
  "id, job_description, match_score, keyword_score, structure_score, format_score, sections_score, strengths, summary, created_at, " +
  "ats_keywords(keyword, status, importance, occurrence_count, suggested_section), ats_issues(source, priority, section_key, message)";

// Reused for both prioritizedFixes and matched/missing keywords — same
// three-level vocabulary (CvAtsFixPriority and CvAtsKeywordImportance
// are structurally identical types), same "insertion order through a
// nested-embed select isn't guaranteed" reason to sort explicitly rather
// than assume the DB handed rows back in the order they were inserted.
const PRIORITY_ORDER: Record<CvAtsFixPriority, number> = { high: 0, medium: 1, low: 2 };

/** Normalized rows (migrations 0031/0032/0033) reassembled into the flat shape the UI renders from — matched/missing keywords (with importance/occurrenceCount/suggestedSection) from ats_keywords, prioritizedFixes from the ai-sourced ats_issues rows — both sorted strongest-importance/priority first. */
function mapAtsScanRow(row: AtsScanRow): CvAtsScan {
  const aiIssues = row.ats_issues.filter((issue) => issue.source === "ai" && issue.priority !== null);
  const byImportance = <T extends { importance: CvAtsFixPriority }>(a: T, b: T) =>
    PRIORITY_ORDER[a.importance] - PRIORITY_ORDER[b.importance];

  return {
    id: row.id,
    jobDescription: row.job_description,
    overallScore: row.match_score,
    keywordScore: row.keyword_score,
    structureScore: row.structure_score,
    formatScore: row.format_score,
    sectionsScore: row.sections_score,
    matchedKeywords: row.ats_keywords
      .filter((k) => k.status === "matched")
      .slice()
      .sort(byImportance)
      .map((k) => ({ term: k.keyword, importance: k.importance, occurrenceCount: k.occurrence_count })),
    missingKeywords: row.ats_keywords
      .filter((k) => k.status === "missing")
      .slice()
      .sort(byImportance)
      .map((k) => ({
        term: k.keyword,
        importance: k.importance,
        occurrenceCount: k.occurrence_count,
        suggestedSection: k.suggested_section as SectionKey | null,
      })),
    strengths: row.strengths,
    prioritizedFixes: aiIssues
      .slice()
      .sort((a, b) => PRIORITY_ORDER[a.priority as CvAtsFixPriority] - PRIORITY_ORDER[b.priority as CvAtsFixPriority])
      .map((issue) => ({
        priority: issue.priority as CvAtsFixPriority,
        sectionKey: issue.section_key as SectionKey | null,
        message: issue.message,
      })),
    summary: row.summary,
    createdAt: row.created_at,
  };
}

/** The current version's most recent scan, if any — shown on page load so the pre-flight panel isn't empty after navigating away and back. */
export async function getLatestAtsScan(userId: string, versionId: string): Promise<CvAtsScan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ats_scans")
    .select(ATS_SCAN_SELECT)
    .eq("cv_version_id", versionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapAtsScanRow(data as unknown as AtsScanRow);
}

const ATS_SCAN_HISTORY_LIMIT = 10;

/** The last `limit` scans for a CV version, most recent first — the dedicated ATS Scanner's "Past scans" list. Full rows (not summaries): picking one just swaps what's displayed, with no second round trip. */
export async function listAtsScanHistory(userId: string, versionId: string, limit = ATS_SCAN_HISTORY_LIMIT): Promise<CvAtsScan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ats_scans")
    .select(ATS_SCAN_SELECT)
    .eq("cv_version_id", versionId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown as AtsScanRow[]).map(mapAtsScanRow);
}

const RECENT_JOB_OPTIONS_LOOKBACK = 30;
const RECENT_JOB_OPTIONS_LIMIT = 8;

/**
 * A user's own past job descriptions, most recent first, deduplicated by
 * exact text — across any of their CVs, since the same job description
 * is often scanned against more than one. Backs "select a previous job"
 * instead of only ever "paste". The `id` returned is the scan whose job
 * description this is — passed back as `reusedFromScanId` when selected,
 * so ats_scans.reused_from_scan_id records the real provenance.
 */
export async function listRecentJobOptions(userId: string): Promise<CvAtsJobOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ats_scans")
    .select("id, job_description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(RECENT_JOB_OPTIONS_LOOKBACK);

  if (error || !data) return [];

  const seen = new Set<string>();
  const options: CvAtsJobOption[] = [];
  for (const row of data) {
    if (seen.has(row.job_description)) continue;
    seen.add(row.job_description);
    options.push({ id: row.id, jobDescription: row.job_description, createdAt: row.created_at });
    if (options.length >= RECENT_JOB_OPTIONS_LIMIT) break;
  }
  return options;
}
