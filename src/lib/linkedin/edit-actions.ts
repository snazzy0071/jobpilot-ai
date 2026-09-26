"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  buildLinkedinDraftSnapshot,
  saveLinkedinDraftVersion,
  applyLinkedinDraftSnapshot,
  ensureLinkedinHistorySnapshot,
  getLinkedinBulletDraftId,
  type LinkedinDraftSnapshot,
} from "@/lib/linkedin/internal";
import {
  saveLinkedinAboutSchema,
  saveLinkedinBulletSchema,
  saveLinkedinHeadlineSchema,
  restoreLinkedinDraftVersionSchema,
} from "@/lib/linkedin/schemas";

// Same (prevState, formData) shape as src/lib/cover-letters/paragraph-actions.ts's autosaved actions, so the CV
// editor's useAutosave/AutosaveStatus are reused unchanged. Deliberately *no* revalidatePath of the draft page in
// the autosave actions: the page keys the detail component by the draft's updated_at, so a revalidation on every
// autosave tick would remount it mid-typing.
export type LinkedinEditResult = { error: string } | { success: string } | void;

/**
 * Autosaved manual edits of the optimised text. Editing your own saved text is plain persistence, not an AI call, so
 * it isn't plan-gated (same as editing a CV or a cover letter after a downgrade) — only the generate/regenerate
 * actions, which spend AI, are. Each first takes a throttled history checkpoint so an edit can always be undone.
 */
export async function saveLinkedinAbout(_prevState: LinkedinEditResult, formData: FormData): Promise<LinkedinEditResult> {
  const user = await requireUser();
  const parsed = saveLinkedinAboutSchema.safeParse({ draftId: formData.get("draftId"), about: formData.get("about") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  await ensureLinkedinHistorySnapshot(supabase, user.id, parsed.data.draftId);
  const { data, error } = await supabase
    .from("linkedin_profile_drafts")
    .update({ optimized_about: parsed.data.about })
    .eq("id", parsed.data.draftId)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data || data.length === 0) return { error: "Couldn't save that — try again." };
  return { success: "Saved." };
}

export async function saveLinkedinBullet(_prevState: LinkedinEditResult, formData: FormData): Promise<LinkedinEditResult> {
  const user = await requireUser();
  const parsed = saveLinkedinBulletSchema.safeParse({ bulletId: formData.get("bulletId"), content: formData.get("content") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const draftId = await getLinkedinBulletDraftId(supabase, user.id, parsed.data.bulletId);
  if (!draftId) return { error: "That bullet couldn't be found." };

  await ensureLinkedinHistorySnapshot(supabase, user.id, draftId);
  const { error } = await supabase
    .from("linkedin_experience_bullets")
    .update({ content: parsed.data.content })
    .eq("id", parsed.data.bulletId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't save that — try again." };
  return { success: "Saved." };
}

/** The headline the user is going with — one of the 3 variants, or their own edit of it. Empty clears the choice. */
export async function saveLinkedinHeadline(_prevState: LinkedinEditResult, formData: FormData): Promise<LinkedinEditResult> {
  const user = await requireUser();
  const parsed = saveLinkedinHeadlineSchema.safeParse({ draftId: formData.get("draftId"), headline: formData.get("headline") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  await ensureLinkedinHistorySnapshot(supabase, user.id, parsed.data.draftId);
  const { data, error } = await supabase
    .from("linkedin_profile_drafts")
    .update({ selected_headline: parsed.data.headline === "" ? null : parsed.data.headline })
    .eq("id", parsed.data.draftId)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data || data.length === 0) return { error: "Couldn't save that — try again." };
  return { success: "Saved." };
}

/**
 * Brings a past state back: the whole draft (input text, optimised text, bullets, keyword list) is replaced by the
 * snapshot's. The state being left is snapshotted first, so a restore is itself undoable and nothing is ever lost.
 */
export async function restoreLinkedinDraftVersion(_prevState: LinkedinEditResult, formData: FormData): Promise<LinkedinEditResult> {
  const user = await requireUser();
  const parsed = restoreLinkedinDraftVersionSchema.safeParse({ draftId: formData.get("draftId"), versionId: formData.get("versionId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("linkedin_draft_versions")
    .select("snapshot")
    .eq("id", parsed.data.versionId)
    .eq("draft_id", parsed.data.draftId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!version) return { error: "That version couldn't be found." };

  const label = `Before restoring an earlier version — ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
  const current = await buildLinkedinDraftSnapshot(supabase, user.id, parsed.data.draftId);
  if (!current || !(await saveLinkedinDraftVersion(supabase, user.id, parsed.data.draftId, label, current))) {
    return { error: "Couldn't back up the current version first, so nothing was changed — try again." };
  }

  if (!(await applyLinkedinDraftSnapshot(supabase, user.id, parsed.data.draftId, version.snapshot as LinkedinDraftSnapshot))) {
    // The draft may be half-restored — put the state we just backed up straight back.
    await applyLinkedinDraftSnapshot(supabase, user.id, parsed.data.draftId, current);
    return { error: "Couldn't restore that version — your draft was left as it was." };
  }

  revalidatePath(`/dashboard/linkedin/${parsed.data.draftId}`);
  revalidatePath("/dashboard/linkedin");
  return { success: "Restored." };
}
