import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonForm } from "@/components/admin/comparisons/comparison-form";
import { getComparisonById } from "@/lib/comparisons/queries";

export const dynamic = "force-dynamic";

export default async function EditComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getComparisonById(id);
  if (!page) notFound();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/compare"><ArrowLeftIcon /> Comparisons</Link>} />
      <ComparisonForm page={page} />
    </div>
  );
}
