import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { FeatureBadge } from "@/components/marketing/feature-badge";
import { QuickAnswer } from "@/components/marketing/quick-answer";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import type { PlanTier } from "@/config/plans";

export function FeatureHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  plan,
  quickAnswer,
  demo,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  plan: PlanTier;
  quickAnswer: string;
  demo?: React.ReactNode;
}) {
  return (
    <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 sm:pt-32">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        {/* No real "/features" index page exists, so this stays a plain
            two-level Home > Title trail rather than an unlinkable
            middle crumb (see visa-sponsors' three-level version for the
            pattern this follows). */}
        <div className="w-full self-start">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />
        </div>
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-lg text-muted-foreground">{description}</p>
        <FeatureBadge plan={plan} />
      </div>
      {demo && <div className="mt-12 flex justify-center">{demo}</div>}
      <div className="mt-10">
        <QuickAnswer>{quickAnswer}</QuickAnswer>
      </div>
    </Section>
  );
}
