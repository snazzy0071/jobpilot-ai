import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getVersionSections, type VersionSections } from "@/lib/cvs/queries";

// Shared by both actions.ts (cv/version-level: duplicate, restore,
// history snapshots) and section-actions.ts (row-level CRUD) —
// deliberately its own module so neither of those two ever needs to
// import from the other, which would risk a circular import between
// them as this file's own helpers evolved.

/**
 * Row Level Security on every cv_* table only checks `auth.uid() =
 * user_id` on the row being written — it has no way to know whether the
 * `cv_version_id`/target version a request supplies actually belongs to
 * a version *this* user owns, since that's a different table. Every
 * write path in src/lib/cvs/ calls this first — which is also why it's
 * the one place `ensureHistorySnapshot` (below) is invoked from: every
 * content/order/restore write already passes through here, so history
 * protection applies everywhere for free instead of needing to be
 * separately wired into ~20 call sites.
 */
export async function assertOwnsVersion(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
): Promise<{ cvId: string } | null> {
  const owner = await getVersionOwner(supabase, userId, versionId);
  if (!owner) return null;

  await ensureHistorySnapshot(supabase, userId, versionId, owner.cvId);

  return owner;
}

/**
 * The same ownership check as `assertOwnsVersion`, without the history
 * snapshot — for paths that need to confirm ownership before doing real
 * work (an AI rewrite, an ATS scan) but don't themselves write cv_*
 * content, so there's nothing for history to protect yet. Used by
 * src/lib/cvs/ai-actions.ts and ats-actions.ts.
 */
export async function getVersionOwner(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
): Promise<{ cvId: string } | null> {
  const { data, error } = await supabase
    .from("cv_versions")
    .select("cv_id")
    .eq("id", versionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  return { cvId: data.cv_id as string };
}

/**
 * Persists an AI rewrite suggestion into ats_rewrites (migration 0031) —
 * a record of what was suggested and, once the caller resolves it via
 * resolveAtsRewrite (src/lib/cvs/ai-actions.ts), whether it was accepted
 * or rejected. Best-effort: a failed insert doesn't fail the rewrite
 * itself (the suggestion is still real and still shown), it just means
 * this particular suggestion won't be resolvable later. Shared (not
 * defined directly in ai-actions.ts, a "use server" file where every
 * export becomes a Server Action) so ai-actions.ts's general-purpose
 * rewrites and keyword-rewrite-actions.ts's keyword-targeted ones both
 * write the exact same row shape.
 */
export async function persistRewrite(
  supabase: SupabaseClient,
  params: {
    userId: string;
    versionId: string;
    sectionKey: "summary" | "experience";
    originalText: string;
    suggestedText: string;
    explanation: string;
    promptVersion: string;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("ats_rewrites")
    .insert({
      user_id: params.userId,
      cv_version_id: params.versionId,
      section_key: params.sectionKey,
      original_text: params.originalText,
      suggested_text: params.suggestedText,
      explanation: params.explanation,
      prompt_version: params.promptVersion,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Couldn't persist ats_rewrites row:", error?.message);
    return null;
  }
  return data.id as string;
}

export async function nextDisplayOrder(supabase: SupabaseClient, table: string, versionId: string): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("display_order")
    .eq("cv_version_id", versionId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.display_order ?? -1) + 1;
}

type SectionInsert = PromiseLike<{ error: { message: string } | null }>;

/**
 * Copies every section row from an already-fetched `VersionSections`
 * bundle into `targetVersionId` — the one place this insert-everything
 * logic lives, used by `duplicateCv` (a new cv+version) and
 * `ensureHistorySnapshot` below (a history checkpoint on the same cv).
 * Returns false if any insert failed; the caller decides how to react
 * (duplicateCv rolls back and reports an error, a snapshot failure is
 * logged and swallowed — see below).
 */
export async function copySectionsToVersion(
  supabase: SupabaseClient,
  userId: string,
  targetVersionId: string,
  sections: VersionSections,
): Promise<boolean> {
  const inserts: SectionInsert[] = [];

  if (sections.personal) {
    inserts.push(
      supabase.from("cv_personal").insert({
        cv_version_id: targetVersionId,
        user_id: userId,
        full_name: sections.personal.fullName,
        headline: sections.personal.headline,
        email: sections.personal.email,
        phone: sections.personal.phone,
        location: sections.personal.location,
        website_url: sections.personal.websiteUrl,
        linkedin_url: sections.personal.linkedinUrl,
        portfolio_url: sections.personal.portfolioUrl,
      }),
    );
  }

  if (sections.summary) {
    inserts.push(
      supabase
        .from("cv_summary")
        .insert({ cv_version_id: targetVersionId, user_id: userId, content: sections.summary.content }),
    );
  }

  if (sections.experience.length > 0) {
    inserts.push(
      supabase.from("cv_experience").insert(
        sections.experience.map((row) => ({
          cv_version_id: targetVersionId,
          user_id: userId,
          job_title: row.jobTitle,
          employer: row.employer,
          location: row.location,
          start_date: row.startDate,
          end_date: row.endDate,
          is_current: row.isCurrent,
          description: row.description,
          display_order: row.displayOrder,
        })),
      ),
    );
  }

  if (sections.education.length > 0) {
    inserts.push(
      supabase.from("cv_education").insert(
        sections.education.map((row) => ({
          cv_version_id: targetVersionId,
          user_id: userId,
          institution: row.institution,
          qualification: row.qualification,
          field_of_study: row.fieldOfStudy,
          location: row.location,
          start_date: row.startDate,
          end_date: row.endDate,
          is_current: row.isCurrent,
          grade: row.grade,
          description: row.description,
          display_order: row.displayOrder,
        })),
      ),
    );
  }

  if (sections.skills.length > 0) {
    inserts.push(
      supabase.from("cv_skills").insert(
        sections.skills.map((row) => ({
          cv_version_id: targetVersionId,
          user_id: userId,
          name: row.name,
          category: row.category,
          display_order: row.displayOrder,
          is_visible: row.isVisible,
        })),
      ),
    );
  }

  if (sections.projects.length > 0) {
    inserts.push(
      supabase.from("cv_projects").insert(
        sections.projects.map((row) => ({
          cv_version_id: targetVersionId,
          user_id: userId,
          name: row.name,
          description: row.description,
          url: row.url,
          technologies: row.technologies,
          start_date: row.startDate,
          end_date: row.endDate,
          is_ongoing: row.isOngoing,
          display_order: row.displayOrder,
          is_visible: row.isVisible,
        })),
      ),
    );
  }

  if (sections.certifications.length > 0) {
    inserts.push(
      supabase.from("cv_certifications").insert(
        sections.certifications.map((row) => ({
          cv_version_id: targetVersionId,
          user_id: userId,
          name: row.name,
          issuing_organization: row.issuingOrganization,
          issue_date: row.issueDate,
          expiry_date: row.expiryDate,
          credential_id: row.credentialId,
          credential_url: row.credentialUrl,
          display_order: row.displayOrder,
          is_visible: row.isVisible,
        })),
      ),
    );
  }

  if (sections.languages.length > 0) {
    inserts.push(
      supabase.from("cv_languages").insert(
        sections.languages.map((row) => ({
          cv_version_id: targetVersionId,
          user_id: userId,
          name: row.name,
          proficiency: row.proficiency,
          display_order: row.displayOrder,
          is_visible: row.isVisible,
        })),
      ),
    );
  }

  if (sections.customSections.length > 0) {
    inserts.push(
      supabase.from("cv_custom_sections").insert(
        sections.customSections.map((row) => ({
          cv_version_id: targetVersionId,
          user_id: userId,
          title: row.title,
          content: row.content,
          display_order: row.displayOrder,
          is_visible: row.isVisible,
        })),
      ),
    );
  }

  const results = await Promise.all(inserts);
  return !results.some((result) => result.error);
}

const SNAPSHOT_THROTTLE_MS = 30 * 60 * 1000;

/**
 * Recoverable version history, without a snapshot on every keystroke:
 * before an autosaved edit is applied, if this version hasn't been
 * snapshotted in the last 30 minutes, copy its *current* content into a
 * new, non-current version first (a restorable checkpoint), then let
 * the real edit proceed on this version as normal. Any autosave within
 * that window reuses the same checkpoint instead of creating another
 * near-duplicate one.
 *
 * Best-effort: a failed snapshot is logged, never thrown — the user's
 * actual edit must never be blocked by history bookkeeping failing.
 */
export async function ensureHistorySnapshot(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
  cvId: string,
): Promise<void> {
  const { data: version, error } = await supabase
    .from("cv_versions")
    .select("last_snapshotted_at")
    .eq("id", versionId)
    .maybeSingle();
  if (error || !version) return;

  const lastSnapshotAt = version.last_snapshotted_at ? new Date(version.last_snapshotted_at).getTime() : 0;
  if (Date.now() - lastSnapshotAt < SNAPSHOT_THROTTLE_MS) return;

  try {
    const sections = await getVersionSections(versionId);

    const { data: snapshotVersion, error: snapshotError } = await supabase
      .from("cv_versions")
      .insert({
        cv_id: cvId,
        user_id: userId,
        is_current: false,
        label: `Autosaved ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
      })
      .select("id")
      .single();
    if (snapshotError || !snapshotVersion) {
      console.error("ensureHistorySnapshot: failed to create snapshot version:", snapshotError?.message);
      return;
    }

    const copied = await copySectionsToVersion(supabase, userId, snapshotVersion.id, sections);
    if (!copied) {
      console.error("ensureHistorySnapshot: failed to copy sections into snapshot version");
      await supabase.from("cv_versions").delete().eq("id", snapshotVersion.id);
      return;
    }

    await supabase.from("cv_versions").update({ last_snapshotted_at: new Date().toISOString() }).eq("id", versionId);
  } catch (err) {
    console.error("ensureHistorySnapshot failed:", err);
  }
}
