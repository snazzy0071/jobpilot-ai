import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

export type JourneyStep = {
  title: string;
  description: string;
  /** Optional — falls back to the plain numbered circle when omitted, so existing callers (for-universities) render exactly as before. */
  icon?: LucideIcon;
};

export function JourneySteps({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
      {/* The connecting line only makes sense on the single-row desktop
          layout — hidden below lg, where steps wrap onto several rows
          and a straight line would cut across unrelated cards. */}
      <div className="absolute top-[18px] right-0 left-0 hidden h-px bg-gradient-to-r from-primary/40 via-border to-brand-secondary/40 lg:block" aria-hidden="true" />
      {steps.map((step, index) => (
        <Reveal
          key={step.title}
          as="li"
          className="relative flex flex-col gap-2"
          delay={Math.min(index * 0.06, 0.3)}
        >
          <span className="gradient-brand relative flex size-9 items-center justify-center rounded-full text-sm font-semibold text-white shadow-elevated ring-4 ring-background">
            {step.icon ? <step.icon className="size-4" /> : index + 1}
          </span>
          <p className="font-medium">{step.title}</p>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </Reveal>
      ))}
    </ol>
  );
}
