import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuideForm } from "@/components/admin/advice/guide-form";

export default function NewGuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/advice-hub"><ArrowLeftIcon /> Advice Hub</Link>} />
      <h1 className="font-heading text-2xl font-semibold tracking-tight">New guide</h1>
      <GuideForm />
    </div>
  );
}
