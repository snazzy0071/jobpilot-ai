import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Reveal } from "@/components/motion/reveal";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { StaggerItem } from "@/components/motion/stagger-item";
import { cn } from "@/lib/utils";

export type SplitPoint = { icon: LucideIcon; title: string; description: string };

/**
 * The layout for every "fill in a form" page (contact, demo, partners,
 * newsletter): copy and reassurance points on the left, the form in an
 * elevated, glow-backed card on the right. The form itself is passed
 * in untouched, so its actions, validation and success states are
 * exactly what they were.
 */
export function SplitFormPage({
  eyebrow,
  title,
  description,
  points,
  form,
  formTitle,
  formNote,
  aside,
  asSection = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  points?: SplitPoint[];
  form: React.ReactNode;
  formTitle?: string;
  formNote?: React.ReactNode;
  /** Extra content under the points (a visual, a quote-free trust chip row). */
  aside?: React.ReactNode;
  /** Use as a mid-page section: h2 heading, no hero glow / top padding, muted tone. */
  asSection?: boolean;
}) {
  const Heading = asSection ? "h2" : "h1";
  return (
    <Section tone={asSection ? "muted" : "default"} decorative={asSection ? true : undefined} className={asSection ? undefined : "hero-glow pt-24 pb-24 sm:pt-32"}>
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <Reveal className="flex flex-col gap-6 text-center lg:pt-6 lg:text-left">
          <div className="flex flex-col items-center gap-4 lg:items-start">
            <Eyebrow>{eyebrow}</Eyebrow>
            <Heading className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{title}</Heading>
            <div className="max-w-xl text-lg text-pretty text-muted-foreground">{description}</div>
          </div>

          {points && points.length > 0 && (
            <StaggerContainer as="ul" className="flex flex-col gap-3 text-left" initialDelay={0.2}>
              {points.map((point) => (
                <StaggerItem
                  as="li"
                  key={point.title}
                  className="group flex items-start gap-4 rounded-2xl border bg-card/70 p-4 backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-elevated"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <point.icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{point.title}</p>
                    <p className="text-sm text-muted-foreground">{point.description}</p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
          {aside}
        </Reveal>

        <Reveal delay={0.15} direction="left" distance={24} className="relative">
          <div
            className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-brand-secondary/20 blur-2xl"
            aria-hidden="true"
          />
          <div className="rounded-3xl border bg-card p-6 shadow-floating sm:p-8">
            {formTitle && <h2 className="mb-6 font-heading text-xl font-semibold">{formTitle}</h2>}
            {form}
            {formNote && <div className={cn("mt-6 border-t pt-4 text-center text-sm text-muted-foreground")}>{formNote}</div>}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
