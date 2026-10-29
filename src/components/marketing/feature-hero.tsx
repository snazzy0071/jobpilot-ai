import type { LucideIcon } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { FeatureBadge } from "@/components/marketing/feature-badge";
import { QuickAnswer } from "@/components/marketing/quick-answer";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { ProductFrame } from "@/components/marketing/product-frame";
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
    <PageHero
      // No real "/features" index page exists, so this stays a plain
      // two-level Home > Title trail rather than an unlinkable middle crumb.
      breadcrumbs={<Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />}
      badge={
        <span className="gradient-brand flex size-14 items-center justify-center rounded-2xl text-white shadow-glow">
          <Icon className="size-7" />
        </span>
      }
      eyebrow={eyebrow}
      title={title}
      description={
        <div className="flex flex-col items-center gap-4 lg:items-start">
          <p>{description}</p>
          <FeatureBadge plan={plan} />
        </div>
      }
      visual={
        demo ? (
          <ProductFrame>
            <div className="animate-blob pointer-events-none absolute -inset-10 -z-10 bg-radial from-primary/30 via-brand-cyan/20 to-transparent blur-3xl" aria-hidden="true" />
            <div className="rounded-[1.4rem] border border-white/80 bg-white/60 p-2 shadow-floating backdrop-blur sm:p-3">{demo}</div>
          </ProductFrame>
        ) : undefined
      }
      footer={<QuickAnswer>{quickAnswer}</QuickAnswer>}
      align={demo ? "left" : "center"}
    />
  );
}
