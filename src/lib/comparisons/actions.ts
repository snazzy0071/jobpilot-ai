"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
import { createClient } from "@/lib/supabase/server";
import { comparisonIdSchema, createComparisonSchema, setPublishedSchema, updateComparisonSchema, type ComparisonInput } from "@/lib/comparisons/schemas";
import { publishBlockers } from "@/lib/comparisons/sources";

export type ComparisonActionResult = { error: string } | { id: string };
export type ComparisonMutationResult = { error: string } | { success: string };

// Every action needs `manage_comparisons` (checked here — a Server Action is reachable directly), runs as the caller so the
// table's admin RLS policies (migration 0117) are a second gate, and is audit-logged. A page can only be live with a source behind
// every competitor claim, and that is re-checked whenever a live or scheduled page is saved, so sources can't be stripped from
// something readers can already see.

async function actor() {
  const { user } = await requirePermission("manage_comparisons");
  return { id: user.id, email: user.email ?? null };
}

async function audit(who: { id: string; email: string | null }, action: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await logAdminAction({ actorId: who.id, actorEmail: who.email, action, entityType: "comparison_page", entityId, metadata });
}

function revalidate(slug?: string) {
  revalidatePath("/admin/compare");
  revalidatePath("/compare");
  revalidatePath("/sitemap.xml");
  if (slug) revalidatePath(`/compare/${slug}`);
}

function fromForm(formData: FormData) {
  const get = (key: string) => (formData.get(key) as string | null) ?? "";
  return {
    slug: get("slug"),
    competitorName: get("competitorName"),
    competitorWebsite: get("competitorWebsite"),
    intro: get("intro"),
    features: get("features"),
    pricing: get("pricing"),
    differences: get("differences"),
    faqs: get("faqs"),
    updatedOn: get("updatedOn"),
    publishAt: get("publishAt"),
  };
}

function row(data: ComparisonInput) {
  return {
    slug: data.slug,
    competitor_name: data.competitorName,
    competitor_website: data.competitorWebsite,
    intro: data.intro,
    features: data.features,
    pricing: data.pricing,
    differences: data.differences,
    faqs: data.faqs,
    updated_on: data.updatedOn,
  };
}

const DUPLICATE = "A comparison with that URL slug already exists.";

export async function createComparison(formData: FormData): Promise<ComparisonActionResult> {
  const who = await actor();
  const parsed = createComparisonSchema.safeParse(fromForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Scheduling on creation is a publication: it needs the same sources as going live.
  if (parsed.data.publishAt) {
    const blockers = publishBlockers({ ...parsed.data });
    if (blockers.length > 0) return { error: `Can't schedule yet: ${blockers[0]}` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("comparison_pages").insert({ ...row(parsed.data), published_at: parsed.data.publishAt }).select("id").single();
  if (error) return { error: error.code === "23505" ? DUPLICATE : "Couldn't create that comparison — try again." };

  await audit(who, "comparison_page.create", data.id, { slug: parsed.data.slug, competitor: parsed.data.competitorName });
  revalidate(parsed.data.slug);
  return { id: data.id };
}

export async function updateComparison(_prev: unknown, formData: FormData): Promise<ComparisonMutationResult> {
  const who = await actor();
  const parsed = updateComparisonSchema.safeParse({ id: formData.get("id"), ...fromForm(formData) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("comparison_pages").select("slug, published_at").eq("id", parsed.data.id).maybeSingle();
  if (!existing) return { error: "That comparison couldn't be found." };

  const willBePublished = !!(parsed.data.publishAt ?? existing.published_at);
  if (willBePublished) {
    const blockers = publishBlockers({ ...parsed.data });
    if (blockers.length > 0) return { error: `A live or scheduled comparison needs a source for every claim: ${blockers[0]}` };
  }

  const patch = parsed.data.publishAt ? { ...row(parsed.data), published_at: parsed.data.publishAt } : row(parsed.data);
  const { error } = await supabase.from("comparison_pages").update(patch).eq("id", parsed.data.id);
  if (error) return { error: error.code === "23505" ? DUPLICATE : "Couldn't save that comparison — try again." };

  await audit(who, "comparison_page.update", parsed.data.id, { slug: parsed.data.slug, updatedOn: parsed.data.updatedOn });
  revalidate(parsed.data.slug);
  if (existing.slug !== parsed.data.slug) revalidatePath(`/compare/${existing.slug}`);
  return { success: "Saved." };
}

/** Publish now (only when every claim is sourced) or take back to a draft. */
export async function setComparisonPublished(input: { id: string; published: boolean }): Promise<ComparisonMutationResult> {
  const who = await actor();
  const parsed = setPublishedSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data: page } = await supabase.from("comparison_pages").select("slug, competitor_name, features, pricing, differences, faqs").eq("id", parsed.data.id).maybeSingle();
  if (!page) return { error: "That comparison couldn't be found." };

  if (parsed.data.published) {
    const blockers = publishBlockers({ competitorName: page.competitor_name, features: page.features, pricing: page.pricing, differences: page.differences, faqs: page.faqs });
    if (blockers.length > 0) return { error: `Can't publish yet: ${blockers[0]}` };
  }
  const { error } = await supabase.from("comparison_pages").update({ published_at: parsed.data.published ? new Date().toISOString() : null }).eq("id", parsed.data.id);
  if (error) return { error: "Couldn't update that comparison — try again." };

  await audit(who, parsed.data.published ? "comparison_page.publish" : "comparison_page.unpublish", parsed.data.id);
  revalidate(page.slug);
  return { success: parsed.data.published ? "Published." : "Moved to drafts." };
}

export async function deleteComparison(input: { id: string }): Promise<ComparisonMutationResult> {
  const who = await actor();
  const parsed = comparisonIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("comparison_pages").delete().eq("id", parsed.data.id).select("slug").maybeSingle();
  if (error) return { error: "Couldn't delete that comparison — try again." };

  await audit(who, "comparison_page.delete", parsed.data.id, { slug: data?.slug ?? null });
  revalidate(data?.slug);
  return { success: "Deleted." };
}
