import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAdminBlogPostById, listBlogCategories, listBlogAuthors } from "@/lib/admin/blog/queries";
import { PostForm } from "@/components/admin/blog/post-form";

export default async function EditBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, categories, authors] = await Promise.all([getAdminBlogPostById(id), listBlogCategories(), listBlogAuthors()]);
  if (!post) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/blog"><ArrowLeftIcon /> Blog</Link>} />
      <PostForm categories={categories} authors={authors} post={post} />
    </div>
  );
}
