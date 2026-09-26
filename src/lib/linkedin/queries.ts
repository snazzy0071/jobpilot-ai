import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeLinkedinKeywordCoverage } from "@/lib/linkedin/keyword-coverage";
import type {
  LinkedinProfileDraftListItem,
  LinkedinProfileDraftDetail,
  LinkedinExperienceBulletItem,
  LinkedinKeywordTerm,
  LinkedinDraftVersionSummary,
} from "@/lib/linkedin/types";

type DraftRow = {
  id: string;
  title: string;
  target_role: string;
  target_seniority: LinkedinProfileDraftListItem["targetSeniority"];
  current_headline: string;
  current_about: string;
  current_experience: string;
  optimized_headline_concise: string | null;
  optimized_headline_narrative: string | null;
  optimized_headline_keyword_dense: string | null;
  optimized_about: string | null;
  selected_headline: string | null;
  suggested_skills: string[];
  notes: string[];
  keyword_coverage_terms: LinkedinKeywordTerm[];
  generated_at: string | null;
  updated_at: string;
};

type BulletRow = { id: string; content: string; display_order: number };

export async function listLinkedinDrafts(userId: string): Promise<LinkedinProfileDraftListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("linkedin_profile_drafts")
    .select("id, title, target_role, target_seniority, optimized_headline_concise, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    targetRole: row.target_role,
    targetSeniority: row.target_seniority,
    hasGenerated: row.optimized_headline_concise !== null,
    updatedAt: row.updated_at,
  }));
}

export async function getLinkedinDraftDetail(userId: string, draftId: string): Promise<LinkedinProfileDraftDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("linkedin_profile_drafts")
    .select(
      "id, title, target_role, target_seniority, current_headline, current_about, current_experience, optimized_headline_concise, optimized_headline_narrative, optimized_headline_keyword_dense, selected_headline, optimized_about, suggested_skills, notes, keyword_coverage_terms, generated_at, updated_at",
    )
    .eq("id", draftId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as DraftRow;

  const { data: bulletRows } = await supabase
    .from("linkedin_experience_bullets")
    .select("id, content, display_order")
    .eq("draft_id", draftId)
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  const experienceBullets: LinkedinExperienceBulletItem[] = ((bulletRows ?? []) as BulletRow[]).map((bullet) => ({
    id: bullet.id,
    content: bullet.content,
    displayOrder: bullet.display_order,
  }));

  const hasHeadlineVariants = row.optimized_headline_concise !== null;
  const keywordTerms = row.keyword_coverage_terms ?? [];

  // "Before" is exactly what the user pasted — fixed for a given
  // generation, so computed once, here. "After" is *not* computed here:
  // it depends on the current About/Experience-bullet text, which
  // changes the moment a rewrite suggestion is accepted without a full
  // page reload, so src/components/linkedin/linkedin-draft-detail.tsx
  // recomputes it client-side (same pure function, same keyword list)
  // every time that happens, rather than showing a score that's already
  // stale the instant someone accepts a better bullet.
  const beforeText = [row.current_headline, row.current_about, row.current_experience].join("\n");

  return {
    id: row.id,
    title: row.title,
    targetRole: row.target_role,
    targetSeniority: row.target_seniority,
    currentHeadline: row.current_headline,
    currentAbout: row.current_about,
    currentExperience: row.current_experience,
    optimizedHeadlineVariants: hasHeadlineVariants
      ? {
          concise: row.optimized_headline_concise!,
          narrative: row.optimized_headline_narrative!,
          keywordDense: row.optimized_headline_keyword_dense!,
        }
      : null,
    optimizedAbout: row.optimized_about,
    selectedHeadline: row.selected_headline,
    experienceBullets,
    suggestedSkills: row.suggested_skills ?? [],
    notes: row.notes ?? [],
    keywordTerms,
    keywordCoverageBefore: keywordTerms.length > 0 ? computeLinkedinKeywordCoverage(keywordTerms, beforeText) : null,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

/** Past states of one draft, newest first — the history dialog's list. */
export async function listLinkedinDraftVersions(userId: string, draftId: string): Promise<LinkedinDraftVersionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("linkedin_draft_versions")
    .select("id, label, created_at")
    .eq("draft_id", draftId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, label: row.label, createdAt: row.created_at }));
}
