import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideForm } from "@/components/admin/advice/guide-form";
import { getGuideById } from "@/lib/advice/queries";

export const dynamic = "force-dynamic";

export default async function EditGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const guide = await getGuideById(id);
  if (!guide) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/advice-hub"><ArrowLeftIcon /> Advice Hub</Link>} />
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit {guide.title}</h1>
      <GuideForm guide={guide} />
    </div>
  );
}
