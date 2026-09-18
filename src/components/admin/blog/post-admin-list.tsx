"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2Icon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { deleteBlogPost } from "@/lib/admin/blog/actions";
import type { AdminBlogPostSummary } from "@/lib/admin/blog/types";

function isPublished(publishedAt: string | null): boolean {
  return !!publishedAt && new Date(publishedAt) <= new Date();
}

function DeleteButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    setDeleting(true);
    const formData = new FormData();
    formData.set("id", id);
    const result = await deleteBlogPost(undefined, formData);
    if (result && "error" in result) {
      setDeleting(false);
      window.alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${title}`} onClick={handleDelete} disabled={deleting}>
      {deleting ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </Button>
  );
}

export function PostAdminList({ posts }: { posts: AdminBlogPostSummary[] }) {
  if (posts.length === 0) {
    return <Card className="items-center gap-2 p-10 text-center text-sm text-muted-foreground">No posts yet.</Card>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => (
          <TableRow key={post.id}>
            <TableCell className="font-medium">{post.title}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{post.categoryName}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{post.authorName}</TableCell>
            <TableCell>
              <Badge variant={isPublished(post.publishedAt) ? "tinted" : "secondary"}>{isPublished(post.publishedAt) ? "Published" : "Draft"}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon-sm" aria-label={`Edit ${post.title}`} render={<Link href={`/admin/blog/${post.id}/edit`} />}>
                  <Pencil className="size-4" />
                </Button>
                <DeleteButton id={post.id} title={post.title} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
