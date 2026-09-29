import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listAdminBlogPosts } from "@/lib/admin/blog/queries";
import { PostAdminList } from "@/components/admin/blog/post-admin-list";
import { CategoryAuthorForms } from "@/components/admin/blog/category-author-forms";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const posts = await listAdminBlogPosts();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button render={<Link href="/admin/blog/new"><PlusIcon /> New post</Link>} />
      </div>

      <PostAdminList posts={posts} />
      <CategoryAuthorForms />
    </div>
  );
}
