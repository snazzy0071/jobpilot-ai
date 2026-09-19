import { BadgeCheckIcon, BriefcaseIcon, CheckIcon, ShieldCheckIcon } from "lucide-react";
import { CvPreview } from "@/components/marketing/cv-preview";
import { ScoreRing } from "@/components/marketing/home/score-ring";
import { FloatingElement } from "@/components/motion/floating-element";
import { Reveal } from "@/components/motion/reveal";

// Floating layers use the CSS-only FloatingElement (compositor-driven,
// no JS per frame) inside a one-shot Reveal, so the hero costs nothing
// once it has settled. Layers that would crowd a phone screen are
// hidden below `sm`.
function Layer({
  children,
  className,
  delay,
  floatDelay = 0,
}: {
  children: React.ReactNode;
  className: string;
  delay: number;
  floatDelay?: number;
}) {
  return (
    <div className={`absolute z-10 ${className}`}>
      <Reveal delay={delay} distance={10}>
        <FloatingElement delay={floatDelay}>{children}</FloatingElement>
      </Reveal>
    </div>
  );
}

/**
 * The hero's product composition: the animated CV in the middle, with
 * three layers that each name one real feature: the ATS score, the
 * matched keywords, and the sponsor check. A fourth (a job-match card)
 * sits behind the CV on wide screens only.
 */
export function HeroStage() {
  return (
    <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-sm">
      <div
        className="pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/15 via-transparent to-brand-secondary/15 blur-2xl"
        aria-hidden="true"
      />

      <Layer className="-top-3 -left-14 hidden w-48 lg:block" delay={0.5} floatDelay={1}>
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-elevated">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BriefcaseIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">Graduate Software Engineer</p>
            <p className="text-[10px] text-muted-foreground">Matched to your CV</p>
          </div>
        </div>
      </Layer>

      <CvPreview animated />

      <Layer className="-top-5 -right-3 sm:-right-10" delay={0.7}>
        <div className="flex items-center gap-2 rounded-xl border bg-card p-2 pr-3 shadow-floating">
          <ScoreRing value={94} size={44} stroke={5} />
          <div>
            <p className="text-[10px] text-muted-foreground">ATS score</p>
            <p className="text-xs font-semibold text-primary">Ready to send</p>
          </div>
        </div>
      </Layer>

      <Layer className="top-[44%] -left-6 hidden sm:block sm:-left-14" delay={0.9} floatDelay={2}>
        <div className="flex flex-col gap-1.5 rounded-xl border bg-card p-2.5 shadow-elevated">
          {["SQL", "Stakeholder mgmt"].map((word) => (
            <span key={word} className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <span className="flex size-4 items-center justify-center rounded-full bg-primary/10">
                <CheckIcon className="size-2.5" />
              </span>
              {word}
            </span>
          ))}
        </div>
      </Layer>

      <Layer className="-bottom-4 -left-3 sm:-left-10" delay={1.1} floatDelay={3}>
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-floating">
          <span className="flex size-7 items-center justify-center rounded-full bg-success/10 text-success">
            <ShieldCheckIcon className="size-3.5" />
          </span>
          <p className="text-xs font-medium">Sponsor licence found</p>
        </div>
      </Layer>

      <Layer className="-right-3 -bottom-7 hidden sm:block sm:-right-8" delay={1.3} floatDelay={1.5}>
        <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-[11px] font-medium shadow-elevated">
          <BadgeCheckIcon className="size-3.5 text-primary" />
          UK format: A4 · 2 pages
        </div>
      </Layer>
    </div>
  );
}
