"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isTemplateAllowed, TEMPLATE_LOCKED_MESSAGE } from "@/lib/cvs/template-access";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requireUsageAllowed, getLimit, releaseUsage, EntitlementError } from "@/lib/entitlements/service";
import { getCvEditorData } from "@/lib/cvs/queries";
import { assertOwnsVersion, copySectionsToVersion, getVersionOwner } from "@/lib/cvs/internal";
import {
  createCvSchema,
  renameCvSchema,
  cvIdSchema,
  updateCvTemplateSchema,
  restoreVersionSchema,
  reorderSectionsSchema,
} from "@/lib/cvs/schemas";

export type CvActionResult = { error: string } | { success: string } | void;

const CVS_LIST_PATH = "/dashboard/cvs";

/**
 * cv_limit is enforced through the same requireUsageAllowed/releaseUsage
 * pair as every other metered key (src/lib/entitlements/service.ts),
 * per CLAUDE.md's rule and to stay consistent with the existing "CVs: X
 * of Y used this month" display on the dashboard tool card
 * (src/lib/entitlements/tool-access.ts). It's an imperfect fit — the
 * underlying subscription_usage bucket resets monthly, while "how many
 * CVs you currently have" is a standing count, not a monthly rate — so
 * deleteCv below releases usage immediately to keep create/delete/create
 * cycles accurate within a month; the gap that remains (a used slot
 * silently frees itself at the next calendar month even without a
 * delete) is flagged in docs/BUILD_CHECKLIST.md, not fixed here.
 */
async function reserveCvSlot(userId: string): Promise<{ error: string } | null> {
  try {
    await requireUsageAllowed(userId, "cv_limit");
    return null;
  } catch (err) {
    // The generic entitlement wording ("your allowance for this feature this month") doesn't say what to do about it.
    if (err instanceof EntitlementError) {
      return { error: "You've reached your plan's limit for CVs. Delete a CV you no longer need, or upgrade your plan to create more." };
    }
    throw err;
  }
}

export async function createCv(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = createCvSchema.safeParse({
    title: formData.get("title"),
    template: formData.get("template"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // The plan's template allowance (cv_template_count) is enforced here, not just in the picker.
  if (!isTemplateAllowed(parsed.data.template, await getLimit(user.id, "cv_template_count"))) return { error: TEMPLATE_LOCKED_MESSAGE };

  const slotError = await reserveCvSlot(user.id);
  if (slotError) return slotError;

  const supabase = await createClient();
  const { data: cv, error: cvError } = await supabase
    .from("cvs")
    .insert({ user_id: user.id, title: parsed.data.title, template: parsed.data.template })
    .select("id")
    .single();

  if (cvError || !cv) {
    await releaseUsage(user.id, "cv_limit");
    return { error: "Couldn't create that CV — try again." };
  }

  const { error: versionError } = await supabase.from("cv_versions").insert({ cv_id: cv.id, user_id: user.id });

  if (versionError) {
    await releaseUsage(user.id, "cv_limit");
    await supabase.from("cvs").delete().eq("id", cv.id);
    return { error: "Couldn't create that CV — try again." };
  }

  revalidatePath(CVS_LIST_PATH);
  redirect(`/dashboard/cvs/${cv.id}`);
}

export async function renameCv(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = renameCvSchema.safeParse({
    cvId: formData.get("cvId"),
    title: formData.get("title"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: renamed, error } = await supabase
    .from("cvs")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.cvId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: "Couldn't rename that CV — try again." };
  if (!renamed || renamed.length === 0) return { error: "That CV couldn't be found." };

  revalidatePath(CVS_LIST_PATH);
  revalidatePath(`${CVS_LIST_PATH}/${parsed.data.cvId}`);
  return { success: "Renamed." };
}

export async function updateCvTemplate(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = updateCvTemplateSchema.safeParse({
    cvId: formData.get("cvId"),
    template: formData.get("template"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();

  // A template outside the plan's allowance can't be newly chosen. A CV already using one (from an earlier plan) keeps it.
  if (!isTemplateAllowed(parsed.data.template, await getLimit(user.id, "cv_template_count"))) {
    const { data: existing } = await supabase.from("cvs").select("template").eq("id", parsed.data.cvId).eq("user_id", user.id).maybeSingle();
    if (existing?.template !== parsed.data.template) return { error: TEMPLATE_LOCKED_MESSAGE };
  }

  // `.select()` so a zero-row update (wrong id, not the owner, RLS) is an error instead of a silent "success".
  const { data: updated, error } = await supabase
    .from("cvs")
    .update({ template: parsed.data.template })
    .eq("id", parsed.data.cvId)
    .eq("user_id", user.id)
    .select("id");
  if (error) {
    console.error(`Couldn't save template "${parsed.data.template}" for cv ${parsed.data.cvId}:`, error);
    // 22P02 = invalid enum input: the code knows this template but the database's cv_template type doesn't yet.
    if (error.code === "22P02") {
      return { error: "That template isn't available on the server yet — the template library update hasn't been applied to the database." };
    }
    return { error: "Couldn't save the template — try again." };
  }
  if (!updated || updated.length === 0) return { error: "That CV couldn't be found." };

  // The editor page too, not just the list: its server-rendered data (template name, preview) must not stay stale.
  revalidatePath(CVS_LIST_PATH);
  revalidatePath(`${CVS_LIST_PATH}/${parsed.data.cvId}`);
  return { success: "Template updated." };
}

export async function archiveCv(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = cvIdSchema.safeParse({ cvId: formData.get("cvId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cvs")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq("id", parsed.data.cvId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't archive that CV — try again." };

  revalidatePath(CVS_LIST_PATH);
  return { success: "Archived." };
}

export async function unarchiveCv(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = cvIdSchema.safeParse({ cvId: formData.get("cvId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cvs")
    .update({ is_archived: false, archived_at: null })
    .eq("id", parsed.data.cvId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't restore that CV — try again." };

  revalidatePath(CVS_LIST_PATH);
  return { success: "Restored." };
}

export async function deleteCv(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = cvIdSchema.safeParse({ cvId: formData.get("cvId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cvs")
    .delete()
    .eq("id", parsed.data.cvId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: "Couldn't delete that CV — try again." };

  if (data && data.length > 0) {
    await releaseUsage(user.id, "cv_limit");
  }

  revalidatePath(CVS_LIST_PATH);
  return { success: "Deleted." };
}

export async function duplicateCv(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = cvIdSchema.safeParse({ cvId: formData.get("cvId") });
  if (!parsed.success) return { error: "Invalid request." };

  const source = await getCvEditorData(user.id, parsed.data.cvId);
  if (!source) return { error: "That CV couldn't be found." };

  const slotError = await reserveCvSlot(user.id);
  if (slotError) return slotError;

  const supabase = await createClient();

  const { data: newCv, error: cvError } = await supabase
    .from("cvs")
    .insert({ user_id: user.id, title: `${source.cvTitle} (Copy)`, template: source.template })
    .select("id")
    .single();

  if (cvError || !newCv) {
    await releaseUsage(user.id, "cv_limit");
    return { error: "Couldn't duplicate that CV — try again." };
  }

  const { data: newVersion, error: versionError } = await supabase
    .from("cv_versions")
    .insert({ cv_id: newCv.id, user_id: user.id, section_order: source.sectionOrder })
    .select("id")
    .single();

  if (versionError || !newVersion) {
    await releaseUsage(user.id, "cv_limit");
    await supabase.from("cvs").delete().eq("id", newCv.id);
    return { error: "Couldn't duplicate that CV — try again." };
  }

  const copied = await copySectionsToVersion(supabase, user.id, newVersion.id, source);
  if (!copied) {
    await releaseUsage(user.id, "cv_limit");
    await supabase.from("cvs").delete().eq("id", newCv.id);
    return { error: "Couldn't duplicate that CV — try again." };
  }

  revalidatePath(CVS_LIST_PATH);
  return { success: "Duplicated." };
}

/**
 * Makes an earlier version current again — the "recover" half of
 * recoverable version history. Reuses the exact same is_current +
 * demotion-trigger mechanism migration 0024 built for switching between
 * versions in general (see `demote_other_cv_versions_before_update`) —
 * restoring isn't a special case, it's just setting is_current on a
 * version that happens to be older.
 */
export async function restoreVersion(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = restoreVersionSchema.safeParse({
    cvId: formData.get("cvId"),
    versionId: formData.get("versionId"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  // Ownership only — not assertOwnsVersion, which also takes a history checkpoint. Restoring writes no content: it just
  // makes an older version current (the one it replaces stays in the history untouched), so a checkpoint here would
  // only add a stray copy of the version being restored.
  const owned = await getVersionOwner(supabase, user.id, parsed.data.versionId);
  if (!owned || owned.cvId !== parsed.data.cvId) return { error: "That version couldn't be found." };

  const { error } = await supabase
    .from("cv_versions")
    .update({ is_current: true })
    .eq("id", parsed.data.versionId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't restore that version — try again." };

  revalidatePath(`/dashboard/cvs/${parsed.data.cvId}`);
  return { success: "Restored." };
}

export async function reorderSections(_prevState: CvActionResult, formData: FormData): Promise<CvActionResult> {
  const user = await requireUser();
  const parsed = reorderSectionsSchema.safeParse({
    versionId: formData.get("versionId"),
    order: formData.get("order"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That CV couldn't be found." };

  const { error } = await supabase
    .from("cv_versions")
    .update({ section_order: parsed.data.order })
    .eq("id", parsed.data.versionId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't save the new order — try again." };

  revalidatePath(`/dashboard/cvs/${owned.cvId}`);
  return { success: "Reordered." };
}
