import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listBlogCategories, listBlogAuthors } from "@/lib/admin/blog/queries";
import { PostForm } from "@/components/admin/blog/post-form";

export default async function NewBlogPostPage() {
  const [categories, authors] = await Promise.all([listBlogCategories(), listBlogAuthors()]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/blog"><ArrowLeftIcon /> Blog</Link>} />
      <PostForm categories={categories} authors={authors} />
    </div>
  );
}
