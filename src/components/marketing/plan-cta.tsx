import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeatureBadge } from "@/components/marketing/feature-badge";
import type { PlanTier } from "@/config/plans";

export function PlanCta({ plan }: { plan: PlanTier }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border p-10 text-center">
      <FeatureBadge plan={plan} />
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to try it?</h2>
      <p className="text-muted-foreground">Create a free account — no card required.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button render={<Link href="/signup">Create free account</Link>} />
        <Button variant="outline" render={<Link href="/pricing">See plans</Link>} />
      </div>
    </div>
  );
}
