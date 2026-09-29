import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonForm } from "@/components/admin/comparisons/comparison-form";

export default function NewComparisonPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/compare"><ArrowLeftIcon /> Comparisons</Link>} />
      <ComparisonForm />
    </div>
  );
}
