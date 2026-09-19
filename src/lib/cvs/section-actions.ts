"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { assertOwnsVersion, nextDisplayOrder } from "@/lib/cvs/internal";
import {
  personalSchema,
  summarySchema,
  experienceSchema,
  educationSchema,
  skillSchema,
  projectSchema,
  certificationSchema,
  languageSchema,
  customSectionSchema,
  sectionRowIdSchema,
  toggleVisibilitySchema,
  reorderRowsSchema,
} from "@/lib/cvs/schemas";

// `id` is populated on a successful save — the autosave hook needs it
// to know, the moment a brand-new row is first created, which real id
// to attach every subsequent keystroke's save to instead of inserting a
// duplicate row per autosave tick. Update saves also return it (the
// same id the caller already sent), so callers can treat both paths
// identically instead of branching on insert-vs-update themselves.
export type SectionActionResult = { error: string } | { success: string; id?: string } | void;

function editorPath(cvId: string) {
  return `/dashboard/cvs/${cvId}`;
}

export async function savePersonal(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = personalSchema.safeParse({
    versionId: formData.get("versionId"),
    fullName: formData.get("fullName"),
    headline: formData.get("headline"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    location: formData.get("location"),
    websiteUrl: formData.get("websiteUrl"),
    linkedinUrl: formData.get("linkedinUrl"),
    portfolioUrl: formData.get("portfolioUrl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const { error } = await supabase.from("cv_personal").upsert(
    {
      cv_version_id: parsed.data.versionId,
      user_id: user.id,
      full_name: parsed.data.fullName,
      headline: parsed.data.headline ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      location: parsed.data.location ?? null,
      website_url: parsed.data.websiteUrl ?? null,
      linkedin_url: parsed.data.linkedinUrl ?? null,
      portfolio_url: parsed.data.portfolioUrl ?? null,
    },
    { onConflict: "cv_version_id" },
  );
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't save personal details):", error);
    return { error: "Couldn't save personal details — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved." };
}

export async function saveSummary(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = summarySchema.safeParse({
    versionId: formData.get("versionId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const { error } = await supabase
    .from("cv_summary")
    .upsert(
      { cv_version_id: parsed.data.versionId, user_id: user.id, content: parsed.data.content },
      { onConflict: "cv_version_id" },
    );
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't save the summary):", error);
    return { error: "Couldn't save the summary — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved." };
}

export async function saveExperience(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = experienceSchema.safeParse({
    id: formData.get("id") || undefined,
    versionId: formData.get("versionId"),
    jobTitle: formData.get("jobTitle"),
    employer: formData.get("employer"),
    location: formData.get("location"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isCurrent: formData.get("isCurrent") === "on",
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const row = {
    cv_version_id: parsed.data.versionId,
    user_id: user.id,
    job_title: parsed.data.jobTitle,
    employer: parsed.data.employer,
    location: parsed.data.location ?? null,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate ?? null,
    is_current: parsed.data.isCurrent,
    description: parsed.data.description ?? null,
  };

  let savedId = parsed.data.id ?? null;
  let error;
  if (parsed.data.id) {
    // `.select()` so an update that matched no row (deleted in another tab, wrong owner) is an error, not a silent "Saved".
    const result = await supabase.from("cv_experience").update(row).eq("id", parsed.data.id).eq("user_id", user.id).select("id");
    error = result.error ?? (result.data && result.data.length > 0 ? null : { message: "row not found" });
  } else {
    const displayOrder = await nextDisplayOrder(supabase, "cv_experience", parsed.data.versionId);
    const result = await supabase.from("cv_experience").insert({ ...row, display_order: displayOrder }).select("id").single();
    error = result.error;
    savedId = result.data?.id ?? null;
  }
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't save that role):", error);
    return { error: "Couldn't save that role — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved.", id: savedId ?? undefined };
}

export async function deleteExperience(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return deleteSectionRow("cv_experience", formData);
}

export async function reorderExperience(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return reorderSectionRows("cv_experience", formData);
}

export async function saveEducation(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = educationSchema.safeParse({
    id: formData.get("id") || undefined,
    versionId: formData.get("versionId"),
    institution: formData.get("institution"),
    qualification: formData.get("qualification"),
    fieldOfStudy: formData.get("fieldOfStudy"),
    location: formData.get("location"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isCurrent: formData.get("isCurrent") === "on",
    grade: formData.get("grade"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const row = {
    cv_version_id: parsed.data.versionId,
    user_id: user.id,
    institution: parsed.data.institution,
    qualification: parsed.data.qualification,
    field_of_study: parsed.data.fieldOfStudy ?? null,
    location: parsed.data.location ?? null,
    start_date: parsed.data.startDate ?? null,
    end_date: parsed.data.endDate ?? null,
    is_current: parsed.data.isCurrent,
    grade: parsed.data.grade ?? null,
    description: parsed.data.description ?? null,
  };

  let savedId = parsed.data.id ?? null;
  let error;
  if (parsed.data.id) {
    // `.select()` so an update that matched no row (deleted in another tab, wrong owner) is an error, not a silent "Saved".
    const result = await supabase.from("cv_education").update(row).eq("id", parsed.data.id).eq("user_id", user.id).select("id");
    error = result.error ?? (result.data && result.data.length > 0 ? null : { message: "row not found" });
  } else {
    const displayOrder = await nextDisplayOrder(supabase, "cv_education", parsed.data.versionId);
    const result = await supabase.from("cv_education").insert({ ...row, display_order: displayOrder }).select("id").single();
    error = result.error;
    savedId = result.data?.id ?? null;
  }
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't save that qualification):", error);
    return { error: "Couldn't save that qualification — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved.", id: savedId ?? undefined };
}

export async function deleteEducation(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return deleteSectionRow("cv_education", formData);
}

export async function reorderEducation(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return reorderSectionRows("cv_education", formData);
}

export async function saveSkill(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = skillSchema.safeParse({
    id: formData.get("id") || undefined,
    versionId: formData.get("versionId"),
    name: formData.get("name"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const row = {
    cv_version_id: parsed.data.versionId,
    user_id: user.id,
    name: parsed.data.name,
    category: parsed.data.category ?? null,
  };

  let savedId = parsed.data.id ?? null;
  let error;
  if (parsed.data.id) {
    // `.select()` so an update that matched no row (deleted in another tab, wrong owner) is an error, not a silent "Saved".
    const result = await supabase.from("cv_skills").update(row).eq("id", parsed.data.id).eq("user_id", user.id).select("id");
    error = result.error ?? (result.data && result.data.length > 0 ? null : { message: "row not found" });
  } else {
    const displayOrder = await nextDisplayOrder(supabase, "cv_skills", parsed.data.versionId);
    const result = await supabase.from("cv_skills").insert({ ...row, display_order: displayOrder }).select("id").single();
    error = result.error;
    savedId = result.data?.id ?? null;
  }
  if (error) {
    return {
      error: error.code === "23505" ? "That skill is already listed." : "Couldn't save that skill — try again.",
    };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved.", id: savedId ?? undefined };
}

export async function deleteSkill(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return deleteSectionRow("cv_skills", formData);
}

export async function reorderSkills(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return reorderSectionRows("cv_skills", formData);
}

export async function saveProject(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const technologiesRaw = String(formData.get("technologies") ?? "");
  const parsed = projectSchema.safeParse({
    id: formData.get("id") || undefined,
    versionId: formData.get("versionId"),
    name: formData.get("name"),
    description: formData.get("description"),
    url: formData.get("url"),
    technologies: technologiesRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    isOngoing: formData.get("isOngoing") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const row = {
    cv_version_id: parsed.data.versionId,
    user_id: user.id,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    url: parsed.data.url ?? null,
    technologies: parsed.data.technologies,
    start_date: parsed.data.startDate ?? null,
    end_date: parsed.data.endDate ?? null,
    is_ongoing: parsed.data.isOngoing,
  };

  let savedId = parsed.data.id ?? null;
  let error;
  if (parsed.data.id) {
    // `.select()` so an update that matched no row (deleted in another tab, wrong owner) is an error, not a silent "Saved".
    const result = await supabase.from("cv_projects").update(row).eq("id", parsed.data.id).eq("user_id", user.id).select("id");
    error = result.error ?? (result.data && result.data.length > 0 ? null : { message: "row not found" });
  } else {
    const displayOrder = await nextDisplayOrder(supabase, "cv_projects", parsed.data.versionId);
    const result = await supabase.from("cv_projects").insert({ ...row, display_order: displayOrder }).select("id").single();
    error = result.error;
    savedId = result.data?.id ?? null;
  }
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't save that project):", error);
    return { error: "Couldn't save that project — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved.", id: savedId ?? undefined };
}

export async function deleteProject(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return deleteSectionRow("cv_projects", formData);
}

export async function reorderProjects(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return reorderSectionRows("cv_projects", formData);
}

export async function saveCertification(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = certificationSchema.safeParse({
    id: formData.get("id") || undefined,
    versionId: formData.get("versionId"),
    name: formData.get("name"),
    issuingOrganization: formData.get("issuingOrganization"),
    issueDate: formData.get("issueDate"),
    expiryDate: formData.get("expiryDate"),
    credentialId: formData.get("credentialId"),
    credentialUrl: formData.get("credentialUrl"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const row = {
    cv_version_id: parsed.data.versionId,
    user_id: user.id,
    name: parsed.data.name,
    issuing_organization: parsed.data.issuingOrganization,
    issue_date: parsed.data.issueDate ?? null,
    expiry_date: parsed.data.expiryDate ?? null,
    credential_id: parsed.data.credentialId ?? null,
    credential_url: parsed.data.credentialUrl ?? null,
  };

  let savedId = parsed.data.id ?? null;
  let error;
  if (parsed.data.id) {
    // `.select()` so an update that matched no row (deleted in another tab, wrong owner) is an error, not a silent "Saved".
    const result = await supabase.from("cv_certifications").update(row).eq("id", parsed.data.id).eq("user_id", user.id).select("id");
    error = result.error ?? (result.data && result.data.length > 0 ? null : { message: "row not found" });
  } else {
    const displayOrder = await nextDisplayOrder(supabase, "cv_certifications", parsed.data.versionId);
    const result = await supabase
      .from("cv_certifications")
      .insert({ ...row, display_order: displayOrder })
      .select("id")
      .single();
    error = result.error;
    savedId = result.data?.id ?? null;
  }
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't save that certification):", error);
    return { error: "Couldn't save that certification — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved.", id: savedId ?? undefined };
}

export async function deleteCertification(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return deleteSectionRow("cv_certifications", formData);
}

export async function reorderCertifications(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return reorderSectionRows("cv_certifications", formData);
}

export async function saveLanguage(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = languageSchema.safeParse({
    id: formData.get("id") || undefined,
    versionId: formData.get("versionId"),
    name: formData.get("name"),
    proficiency: formData.get("proficiency"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const row = {
    cv_version_id: parsed.data.versionId,
    user_id: user.id,
    name: parsed.data.name,
    proficiency: parsed.data.proficiency,
  };

  let savedId = parsed.data.id ?? null;
  let error;
  if (parsed.data.id) {
    // `.select()` so an update that matched no row (deleted in another tab, wrong owner) is an error, not a silent "Saved".
    const result = await supabase.from("cv_languages").update(row).eq("id", parsed.data.id).eq("user_id", user.id).select("id");
    error = result.error ?? (result.data && result.data.length > 0 ? null : { message: "row not found" });
  } else {
    const displayOrder = await nextDisplayOrder(supabase, "cv_languages", parsed.data.versionId);
    const result = await supabase.from("cv_languages").insert({ ...row, display_order: displayOrder }).select("id").single();
    error = result.error;
    savedId = result.data?.id ?? null;
  }
  if (error) {
    return {
      error: error.code === "23505" ? "That language is already listed." : "Couldn't save that language — try again.",
    };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved.", id: savedId ?? undefined };
}

export async function deleteLanguage(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return deleteSectionRow("cv_languages", formData);
}

export async function reorderLanguages(_prevState: SectionActionResult, formData: FormData): Promise<SectionActionResult> {
  return reorderSectionRows("cv_languages", formData);
}

export async function saveCustomSection(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = customSectionSchema.safeParse({
    id: formData.get("id") || undefined,
    versionId: formData.get("versionId"),
    title: formData.get("title"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const row = {
    cv_version_id: parsed.data.versionId,
    user_id: user.id,
    title: parsed.data.title,
    content: parsed.data.content ?? null,
  };

  let savedId = parsed.data.id ?? null;
  let error;
  if (parsed.data.id) {
    // `.select()` so an update that matched no row (deleted in another tab, wrong owner) is an error, not a silent "Saved".
    const result = await supabase.from("cv_custom_sections").update(row).eq("id", parsed.data.id).eq("user_id", user.id).select("id");
    error = result.error ?? (result.data && result.data.length > 0 ? null : { message: "row not found" });
  } else {
    const displayOrder = await nextDisplayOrder(supabase, "cv_custom_sections", parsed.data.versionId);
    const result = await supabase
      .from("cv_custom_sections")
      .insert({ ...row, display_order: displayOrder })
      .select("id")
      .single();
    error = result.error;
    savedId = result.data?.id ?? null;
  }
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't save that section):", error);
    return { error: "Couldn't save that section — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Saved.", id: savedId ?? undefined };
}

export async function deleteCustomSection(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return deleteSectionRow("cv_custom_sections", formData);
}

export async function reorderCustomSections(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return reorderSectionRows("cv_custom_sections", formData);
}

/**
 * Shared by every many-row section's delete action: validates the row id
 * and the cv/version it needs for revalidation, scopes the delete to the
 * authenticated user (RLS enforces the same thing; this is the explicit,
 * readable version of it), and revalidates the editor page it belongs to.
 */
async function deleteSectionRow(table: string, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsedRow = sectionRowIdSchema.safeParse({ id: formData.get("id") });
  const versionId = String(formData.get("versionId") ?? "");
  if (!parsedRow.success || !versionId) return { error: "Invalid request." };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const { error } = await supabase.from(table).delete().eq("id", parsedRow.data.id).eq("user_id", user.id);
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't delete that entry):", error);
    return { error: "Couldn't delete that entry — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: "Deleted." };
}

/**
 * Shared by every section that supports "keep the entry, just don't show
 * it on the CV" — skills/projects/certifications/languages/custom
 * sections. The new value comes from the client (which already knows
 * the current value and is toggling it), not read-then-flipped here —
 * simpler, and fine for a personal, non-racy per-user toggle.
 */
async function toggleSectionRowVisibility(table: string, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = toggleVisibilitySchema.safeParse({
    id: formData.get("id"),
    versionId: formData.get("versionId"),
    isVisible: formData.get("isVisible"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const { error } = await supabase
    .from(table)
    .update({ is_visible: parsed.data.isVisible })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  if (error) {
    // The user gets a short message; the real cause goes to the server log so a failed save is diagnosable.
    console.error("CV section save failed (Couldn't update visibility):", error);
    return { error: "Couldn't update visibility — try again." };
  }

  revalidatePath(editorPath(owned.cvId));
  return { success: parsed.data.isVisible ? "Shown on CV." : "Hidden from CV." };
}

export async function toggleSkillVisibility(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return toggleSectionRowVisibility("cv_skills", formData);
}

export async function toggleProjectVisibility(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return toggleSectionRowVisibility("cv_projects", formData);
}

export async function toggleCertificationVisibility(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return toggleSectionRowVisibility("cv_certifications", formData);
}

export async function toggleLanguageVisibility(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return toggleSectionRowVisibility("cv_languages", formData);
}

export async function toggleCustomSectionVisibility(
  _prevState: SectionActionResult,
  formData: FormData,
): Promise<SectionActionResult> {
  return toggleSectionRowVisibility("cv_custom_sections", formData);
}

/**
 * Shared by every many-row section's drag-reorder: writes the dragged
 * order's positions (0-based index) as each row's new `display_order`,
 * scoped to both the owning user and this exact version — a stray id
 * from a different version of the same user's cv can't have its order
 * overwritten this way even though the user_id check alone would allow
 * it.
 */
async function reorderSectionRows(table: string, formData: FormData): Promise<SectionActionResult> {
  const user = await requireUser();
  const parsed = reorderRowsSchema.safeParse({
    versionId: formData.get("versionId"),
    orderedIds: formData.get("orderedIds"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const updates = parsed.data.orderedIds.map((id, index) =>
    supabase
      .from(table)
      .update({ display_order: index })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("cv_version_id", parsed.data.versionId),
  );
  const results = await Promise.all(updates);
  if (results.some((result) => result.error)) return { error: "Couldn't save the new order — try again." };

  revalidatePath(editorPath(owned.cvId));
  return { success: "Reordered." };
}
