import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CoverLetterListItem,
  CoverLetterVersionSummary,
  CoverLetterEditorData,
  CoverLetterParagraph,
  CoverLetterTone,
  CoverLetterLength,
  CoverLetterTemplate,
} from "@/lib/cover-letters/types";

type CoverLetterListVersionRow = { tone: CoverLetterTone; length: CoverLetterLength; is_current: boolean };
type CoverLetterListRow = {
  id: string;
  company_name: string;
  job_title: string;
  template: CoverLetterTemplate;
  created_at: string;
  updated_at: string;
  cover_letter_versions: CoverLetterListVersionRow[] | null;
};

/** Relies on RLS (the caller's own session client) to scope results to the signed-in user, same convention as src/lib/cvs/queries.ts. */
export async function listCoverLetters(userId: string): Promise<CoverLetterListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cover_letters")
    .select(
      "id, company_name, job_title, template, created_at, updated_at, cover_letter_versions(tone, length, is_current)",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as CoverLetterListRow[])
    .map((row) => {
      const current = (row.cover_letter_versions ?? []).find((v) => v.is_current) ?? null;
      if (!current) return null;
      return {
        id: row.id,
        companyName: row.company_name,
        jobTitle: row.job_title,
        tone: current.tone,
        length: current.length,
        template: row.template,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    })
    .filter((item): item is CoverLetterListItem => item !== null);
}

export async function listCoverLetterVersions(userId: string, coverLetterId: string): Promise<CoverLetterVersionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cover_letter_versions")
    .select("id, version_number, label, is_current, created_at")
    .eq("cover_letter_id", coverLetterId)
    .eq("user_id", userId)
    .order("version_number", { ascending: false });

  if (error) {
    console.error("listCoverLetterVersions failed:", error.message);
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

/** Every paragraph for one specific version, in display order — the shared fetch behind both getCoverLetterEditorData (always the *current* version) and the history-snapshot/duplicate copy paths, same role as src/lib/cvs/queries.ts's getVersionSections. */
export async function getVersionParagraphs(versionId: string): Promise<CoverLetterParagraph[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cover_letter_paragraphs")
    .select("id, content, display_order")
    .eq("version_id", versionId)
    .order("display_order", { ascending: true });

  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, content: row.content, displayOrder: row.display_order }));
}

type CvPersonalSenderRow = { full_name: string; email: string | null; phone: string | null; location: string | null };

/**
 * The letterhead's sender details, pulled from the linked CV's own
 * personal section rather than collected separately by this feature —
 * `cv_version_id` is nullable (a cover letter version isn't required to
 * have one — see migration 0038's comment on that column), so a missing
 * link or a CV with no personal details filled in yet both resolve to
 * "no sender details", not an error.
 */
async function getSenderDetails(
  userId: string,
  cvVersionId: string | null,
): Promise<{ name: string | null; email: string | null; phone: string | null; location: string | null }> {
  if (!cvVersionId) return { name: null, email: null, phone: null, location: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cv_personal")
    .select("full_name, email, phone, location")
    .eq("cv_version_id", cvVersionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { name: null, email: null, phone: null, location: null };

  const row = data as CvPersonalSenderRow;
  return { name: row.full_name, email: row.email, phone: row.phone, location: row.location };
}

/**
 * Ownership is re-checked here as a defensive `.eq("user_id", userId)`,
 * same as getCvEditorData — RLS already guarantees it, this just makes
 * that guarantee explicit at the query layer too.
 */
export async function getCoverLetterEditorData(userId: string, coverLetterId: string): Promise<CoverLetterEditorData | null> {
  const supabase = await createClient();

  const { data: letter, error: letterError } = await supabase
    .from("cover_letters")
    .select("id, company_name, job_title, job_description, template")
    .eq("id", coverLetterId)
    .eq("user_id", userId)
    .maybeSingle();
  if (letterError || !letter) return null;

  const { data: version, error: versionError } = await supabase
    .from("cover_letter_versions")
    .select("id, version_number, tone, length, cv_version_id")
    .eq("cover_letter_id", coverLetterId)
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (versionError || !version) return null;

  const [paragraphs, sender] = await Promise.all([
    getVersionParagraphs(version.id),
    getSenderDetails(userId, version.cv_version_id),
  ]);

  return {
    coverLetterId: letter.id,
    companyName: letter.company_name,
    jobTitle: letter.job_title,
    jobDescription: letter.job_description,
    template: letter.template,
    versionId: version.id,
    versionNumber: version.version_number,
    tone: version.tone,
    length: version.length,
    senderName: sender.name,
    senderEmail: sender.email,
    senderPhone: sender.phone,
    senderLocation: sender.location,
    paragraphs,
  };
}
