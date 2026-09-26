import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JourneyStepper, JourneySteps } from "@/components/graduate-schemes/preparation/journey-steps";
import { requireUser } from "@/lib/auth/session";
import { getPublishedSchemeBySlug } from "@/lib/graduate-schemes/queries";
import { getPreparationState } from "@/lib/graduate-schemes/preparation/queries";
import { GRADUATE_SCHEME_SECTOR_LABELS } from "@/lib/graduate-schemes/types";

export const dynamic = "force-dynamic";

/** The Prepare Application journey for one scheme: scheme → CV → ATS → tests → interview → tracker, with progress saved per user and scheme. */
export default async function PrepareApplicationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const scheme = await getPublishedSchemeBySlug(slug);
  if (!scheme) notFound();

  let state;
  try {
    state = await getPreparationState(user.id, scheme);
  } catch (error) {
    console.error("PrepareApplicationPage failed:", error);
    return (
      <Card className="mx-auto max-w-2xl p-8 text-center" role="alert">
        <p className="font-medium">We couldn&apos;t load your preparation just now.</p>
        <p className="mt-1 text-sm text-muted-foreground">Try again in a moment — nothing you did has been lost.</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" render={<Link href={`/graduate-schemes/${scheme.slug}`}><ArrowLeftIcon /> Back to the scheme</Link>} />

      <div>
        <p className="text-sm text-muted-foreground">
          {scheme.employer} · {GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}
        </p>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Prepare your application: {scheme.schemeName}</h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={state.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Preparation progress">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${state.percent}%` }} />
          </div>
          <span className="text-sm font-medium" data-testid="journey-percent">
            {state.percent}%
          </span>
        </div>
      </div>

      <JourneyStepper state={state} />
      <JourneySteps scheme={scheme} state={state} />
    </div>
  );
}
