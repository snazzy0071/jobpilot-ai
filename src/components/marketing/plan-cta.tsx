import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FeatureBadge } from "@/components/marketing/feature-badge";
import { AnimatedGradient } from "@/components/motion/animated-gradient";
import { Reveal } from "@/components/motion/reveal";
import type { PlanTier } from "@/config/plans";

export function PlanCta({ plan }: { plan: PlanTier }) {
  return (
    <Reveal className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border bg-card p-10 text-center shadow-elevated sm:p-14">
      <AnimatedGradient
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        gradient="var(--gradient-brand)"
      />
      <div className="relative flex flex-col items-center gap-4">
        <FeatureBadge plan={plan} />
        <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-4xl">Ready to try it?</h2>
        <p className="text-muted-foreground">Create a free account. No card required.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button size="lg" variant="gradient" render={<Link href="/signup">Create free account</Link>} />
          <Button size="lg" variant="outline" render={<Link href="/pricing">See plans</Link>} />
        </div>
      </div>
    </Reveal>
  );
}
