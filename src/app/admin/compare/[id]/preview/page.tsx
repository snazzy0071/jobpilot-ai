import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparisonView } from "@/components/comparisons/comparison-view";
import { getComparisonById } from "@/lib/comparisons/queries";
import { publishBlockers } from "@/lib/comparisons/sources";

export const dynamic = "force-dynamic";

/** The comparison exactly as readers will see it, whether or not it's published — plus what still blocks publishing. */
export default async function PreviewComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = await getComparisonById(id);
  if (!page) notFound();
  const blockers = publishBlockers(page);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href="/admin/compare"><ArrowLeftIcon /> Comparisons</Link>} />
      <div className="rounded-lg border bg-muted/40 p-3 text-sm" data-testid="preview-banner">
        <p className="font-medium">Preview — {page.publishedAt ? "this page is published or scheduled" : "this page is a draft and not public"}.</p>
        {blockers.length > 0 ? (
          <ul className="mt-1 list-disc pl-5 text-destructive" data-testid="preview-blockers">
            {blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground" data-testid="preview-ready">Every competitor claim has a source — ready to publish.</p>
        )}
      </div>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">JobPilot AI vs {page.competitorName}</h1>
      <ComparisonView page={page} />
    </div>
  );
}
