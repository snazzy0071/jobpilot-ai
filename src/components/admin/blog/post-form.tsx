"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentBlockEditor } from "@/components/admin/blog/content-block-editor";
import { createBlogPost, updateBlogPost } from "@/lib/admin/blog/actions";
import type { AdminBlogCategory, AdminBlogAuthor, AdminBlogPost } from "@/lib/admin/blog/types";

export function PostForm({
  categories,
  authors,
  post,
}: {
  categories: AdminBlogCategory[];
  authors: AdminBlogAuthor[];
  post?: AdminBlogPost;
}) {
  const router = useRouter();
  const isEditing = !!post;

  const [categoryId, setCategoryId] = useState(post?.categoryId ?? categories[0]?.id ?? "");
  const [authorId, setAuthorId] = useState(post?.authorId ?? authors[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = isEditing ? await updateBlogPost(undefined, formData) : await createBlogPost(formData);

    if (response && "error" in response) {
      setLoading(false);
      setError(response.error ?? "Couldn't save that post — try again.");
      return;
    }
    router.push("/admin/blog");
    router.refresh();
  }

  return (
    <Card className="p-8">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEditing && <input type="hidden" name="id" value={post.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="post-title">Title</Label>
            <Input id="post-title" name="title" defaultValue={post?.title} maxLength={300} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="post-slug">Slug</Label>
            <Input id="post-slug" name="slug" defaultValue={post?.slug} maxLength={200} required />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="post-excerpt">Excerpt</Label>
          <Textarea id="post-excerpt" name="excerpt" defaultValue={post?.excerpt} maxLength={500} rows={2} required />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="post-category">Category</Label>
            <Select name="categoryId" items={Object.fromEntries(categories.map((category) => [category.id, category.name]))} value={categoryId} onValueChange={(value) => value && setCategoryId(value)}>
              <SelectTrigger id="post-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="post-author">Author</Label>
            <Select name="authorId" items={Object.fromEntries(authors.map((author) => [author.id, author.name]))} value={authorId} onValueChange={(value) => value && setAuthorId(value)}>
              <SelectTrigger id="post-author" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {authors.map((author) => (
                  <SelectItem key={author.id} value={author.id}>
                    {author.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="post-published">Published (blank = draft)</Label>
            <Input
              id="post-published"
              name="publishedAt"
              type="datetime-local"
              defaultValue={post?.publishedAt ? post.publishedAt.slice(0, 16) : ""}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Content</Label>
          <ContentBlockEditor initialBlocks={post?.content ?? []} />
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
            <AlertCircleIcon className="size-4 shrink-0" /> {error}
          </p>
        )}

        <Button type="submit" disabled={loading || !categoryId || !authorId} className="self-start">
          {loading ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Saving…
            </>
          ) : isEditing ? (
            "Save post"
          ) : (
            "Create post"
          )}
        </Button>
      </form>
    </Card>
  );
}
