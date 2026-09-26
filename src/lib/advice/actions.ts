"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { createClient } from "@/lib/supabase/server";
import { createGuideSchema, guideIdSchema, setFeaturedSchema, setPublishedSchema, updateGuideSchema, type GuideInput } from "@/lib/advice/schemas";
import { slugify, uniqueSlug } from "@/lib/graduate-schemes/slug";

export type GuideActionResult = { error: string } | { id: string };
export type GuideMutationResult = { error: string } | { success: string };

// Every action needs the `manage_advice_hub` permission (not merely "is an admin"), checked here because a Server Action is
// reachable directly. Writes run as the caller, so the table's admin RLS policies (migration 0114) are a second gate. Every
// change is audit-logged. The Blog has its own tables, routes and permission — nothing here touches it.

async function actor() {
  const { user } = await requirePermission("manage_advice_hub");
  return { id: user.id, email: user.email ?? null };
}

async function audit(who: { id: string; email: string | null }, action: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await logAdminAction({ actorId: who.id, actorEmail: who.email, action, entityType: "advice_guide", entityId, metadata });
}

function revalidate(slug?: string) {
  revalidatePath("/admin/advice-hub");
  revalidatePath("/advice-hub");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/advice-hub/${slug}`);
}

function fromForm(formData: FormData) {
  return {
    slug: (formData.get("slug") as string | null) ?? "",
    title: formData.get("title"),
    summary: formData.get("summary"),
    category: formData.get("category"),
    content: formData.get("content"),
    featuredRank: (formData.get("featuredRank") as string | null) ?? "",
    relatedSlugs: (formData.get("relatedSlugs") as string | null) ?? "",
    authorName: (formData.get("authorName") as string | null) ?? "",
    reviewedOn: (formData.get("reviewedOn") as string | null) ?? "",
    publishAt: (formData.get("publishAt") as string | null) ?? "",
  };
}

/** Related slugs must be other real guides — a typo would otherwise silently show nothing. */
async function checkRelated(slugs: string[], ownSlug: string): Promise<string | null> {
  if (slugs.length === 0) return null;
  if (slugs.includes(ownSlug)) return "A guide can't be related to itself.";
  const supabase = await createClient();
  const { data } = await supabase.from("advice_guides").select("slug").in("slug", slugs);
  const found = new Set((data ?? []).map((row) => row.slug));
  const missing = slugs.filter((slug) => !found.has(slug));
  return missing.length > 0 ? `No guide has the slug "${missing[0]}".` : null;
}

function row(data: GuideInput, slug: string) {
  return {
    slug,
    title: data.title,
    summary: data.summary,
    category: data.category,
    content: data.content,
    featured_rank: data.featuredRank,
    related_slugs: data.relatedSlugs,
    author_name: data.authorName,
    reviewed_on: data.reviewedOn,
  };
}

const DUPLICATE = "A guide with that URL slug already exists.";

export async function createGuide(formData: FormData): Promise<GuideActionResult> {
  const who = await actor();
  const parsed = createGuideSchema.safeParse(fromForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  let slug = parsed.data.slug;
  if (!slug) {
    const base = slugify(parsed.data.title);
    const { data: taken } = await supabase.from("advice_guides").select("slug").like("slug", `${base}%`);
    slug = uniqueSlug(base, new Set((taken ?? []).map((r) => r.slug)));
  }
  const relatedError = await checkRelated(parsed.data.relatedSlugs, slug);
  if (relatedError) return { error: relatedError };

  const { data, error } = await supabase
    .from("advice_guides")
    .insert({ ...row(parsed.data, slug), published_at: parsed.data.publishAt })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? DUPLICATE : "Couldn't create that guide — try again." };

  await audit(who, "advice_guide.create", data.id, { slug, category: parsed.data.category, published: !!parsed.data.publishAt });
  revalidate(slug);
  return { id: data.id };
}

export async function updateGuide(_prev: unknown, formData: FormData): Promise<GuideMutationResult> {
  const who = await actor();
  const parsed = updateGuideSchema.safeParse({ id: formData.get("id"), ...fromForm(formData) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("advice_guides").select("slug, published_at").eq("id", parsed.data.id).maybeSingle();
  if (!existing) return { error: "That guide couldn't be found." };
  // A blank slug keeps the current one: changing a published address breaks every link to it, so it only changes on purpose.
  const slug = parsed.data.slug || existing.slug;
  const relatedError = await checkRelated(parsed.data.relatedSlugs, slug);
  if (relatedError) return { error: relatedError };

  // A publish time typed in the form replaces the current one; leaving it blank keeps whatever it is (draft stays draft).
  const patch = parsed.data.publishAt ? { ...row(parsed.data, slug), published_at: parsed.data.publishAt } : row(parsed.data, slug);
  const { error } = await supabase.from("advice_guides").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.code === "23505" ? DUPLICATE : "Couldn't save that guide — try again." };

  await audit(who, "advice_guide.update", parsed.data.id, { slug, category: parsed.data.category });
  revalidate(slug);
  if (slug !== existing.slug) revalidatePath(`/advice-hub/${existing.slug}`);
  return { success: "Saved." };
}

/** Publish now, or take back to a draft. */
export async function setGuidePublished(input: { id: string; published: boolean }): Promise<GuideMutationResult> {
  const who = await actor();
  const parsed = setPublishedSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("advice_guides")
    .update({ published_at: parsed.data.published ? new Date().toISOString() : null })
    .eq("id", parsed.data.id)
    .select("slug")
    .maybeSingle();
  if (error || !data) return { error: "Couldn't update that guide — try again." };

  await audit(who, parsed.data.published ? "advice_guide.publish" : "advice_guide.unpublish", parsed.data.id);
  revalidate(data.slug);
  return { success: parsed.data.published ? "Published." : "Moved to drafts." };
}

/** Feature a guide (at the end of the featured row) or take it off. */
export async function setGuideFeatured(input: { id: string; featured: boolean }): Promise<GuideMutationResult> {
  const who = await actor();
  const parsed = setFeaturedSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  let rank: number | null = null;
  if (parsed.data.featured) {
    const { data: last } = await supabase.from("advice_guides").select("featured_rank").not("featured_rank", "is", null).order("featured_rank", { ascending: false }).limit(1).maybeSingle();
    rank = Math.min((last?.featured_rank ?? 0) + 1, 100);
  }
  const { data, error } = await supabase.from("advice_guides").update({ featured_rank: rank }).eq("id", parsed.data.id).select("slug").maybeSingle();
  if (error || !data) return { error: "Couldn't update that guide — try again." };

  await audit(who, parsed.data.featured ? "advice_guide.feature" : "advice_guide.unfeature", parsed.data.id);
  revalidate(data.slug);
  return { success: parsed.data.featured ? "Featured." : "No longer featured." };
}

export async function deleteGuide(input: { id: string }): Promise<GuideMutationResult> {
  const who = await actor();
  const parsed = guideIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("advice_guides").delete().eq("id", parsed.data.id).select("slug").maybeSingle();
  if (error) return { error: "Couldn't delete that guide — try again." };

  await audit(who, "advice_guide.delete", parsed.data.id, { slug: data?.slug ?? null });
  revalidate(data?.slug);
  return { success: "Deleted." };
}
