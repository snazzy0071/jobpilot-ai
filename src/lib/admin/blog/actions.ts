"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin/permissions";
import {
  createBlogPostSchema,
  updateBlogPostSchema,
  blogPostIdSchema,
  createBlogCategorySchema,
  createBlogAuthorSchema,
} from "@/lib/admin/blog/schemas";

// blog_categories/blog_authors/blog_posts have no insert/update/delete
// RLS policy for anyone (migration 0010's own comment: "write access
// is service-role only, matching access_codes' pattern") — every
// write in this file needs the service-role client, not just the
// posts list's own read.

export async function createBlogPost(formData: FormData) {
  await requirePermission("manage_blog");

  const parsed = createBlogPostSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    excerpt: formData.get("excerpt"),
    categoryId: formData.get("categoryId"),
    authorId: formData.get("authorId"),
    content: formData.get("content"),
    publishedAt: formData.get("publishedAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .insert({
      slug: parsed.data.slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      category_id: parsed.data.categoryId,
      author_id: parsed.data.authorId,
      content: parsed.data.content,
      published_at: parsed.data.publishedAt,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "That slug is already in use." };
    return { error: "Couldn't create that post — try again." };
  }

  revalidatePath("/admin/blog");
  return { id: data.id as string };
}

export async function updateBlogPost(_prevState: unknown, formData: FormData) {
  await requirePermission("manage_blog");

  const parsed = updateBlogPostSchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    title: formData.get("title"),
    excerpt: formData.get("excerpt"),
    categoryId: formData.get("categoryId"),
    authorId: formData.get("authorId"),
    content: formData.get("content"),
    publishedAt: formData.get("publishedAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin
    .from("blog_posts")
    .update({
      slug: parsed.data.slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      category_id: parsed.data.categoryId,
      author_id: parsed.data.authorId,
      content: parsed.data.content,
      published_at: parsed.data.publishedAt,
    })
    .eq("id", parsed.data.id);
  if (error) {
    if (error.code === "23505") return { error: "That slug is already in use." };
    return { error: "Couldn't update that post — try again." };
  }

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${parsed.data.slug}`);
}

export async function deleteBlogPost(_prevState: unknown, formData: FormData) {
  await requirePermission("manage_blog");

  const parsed = blogPostIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const admin = createAdminClient();
  const { error } = await admin.from("blog_posts").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that post — try again." };

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
}

export async function createBlogCategory(formData: FormData) {
  await requirePermission("manage_blog");

  const parsed = createBlogCategorySchema.safeParse({ slug: formData.get("slug"), name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("blog_categories").insert({ slug: parsed.data.slug, name: parsed.data.name });
  if (error) {
    if (error.code === "23505") return { error: "That slug is already in use." };
    return { error: "Couldn't create that category — try again." };
  }

  revalidatePath("/admin/blog");
}

export async function createBlogAuthor(formData: FormData) {
  await requirePermission("manage_blog");

  const parsed = createBlogAuthorSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    bio: formData.get("bio"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { error } = await admin.from("blog_authors").insert({ slug: parsed.data.slug, name: parsed.data.name, bio: parsed.data.bio });
  if (error) {
    if (error.code === "23505") return { error: "That slug is already in use." };
    return { error: "Couldn't create that author — try again." };
  }

  revalidatePath("/admin/blog");
}
