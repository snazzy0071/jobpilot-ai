import { CheckIcon } from "lucide-react";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { ProductFrame } from "@/components/marketing/product-frame";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

const GLOWS = {
  blue: "from-primary/30 via-brand-cyan/20 to-transparent",
  cyan: "from-brand-cyan/35 via-primary/15 to-transparent",
  coral: "from-brand-coral/30 via-brand-sun/20 to-transparent",
  sun: "from-brand-sun/35 via-brand-coral/15 to-transparent",
} as const;

/**
 * A two-column product story: copy (eyebrow, headline, lead, check-list, actions) beside a live demo that sits on a
 * colourful glow. `flip` puts the demo on the left on wide screens. Copy always comes first on phones.
 */
export function FeatureSplit({
  eyebrow,
  title,
  lead,
  bullets,
  actions,
  visual,
  flip = false,
  glow = "blue",
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead: React.ReactNode;
  bullets?: string[];
  actions?: React.ReactNode;
  visual: React.ReactNode;
  flip?: boolean;
  glow?: keyof typeof GLOWS;
}) {
  return (
    <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <Reveal className={cn("flex flex-col gap-5", flip && "lg:order-2")} direction={flip ? "left" : "right"} distance={24}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">{title}</h2>
        <p className="text-lg text-pretty text-muted-foreground">{lead}</p>
        {bullets && bullets.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-[0.95rem]">
                <span className="gradient-brand mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white shadow-[0_4px_10px_-3px_rgba(51,80,255,0.6)]">
                  <CheckIcon className="size-3" strokeWidth={3} />
                </span>
                {bullet}
              </li>
            ))}
          </ul>
        )}
        {actions && <div className="mt-1 flex flex-wrap gap-3">{actions}</div>}
      </Reveal>
      <Reveal className={cn("relative", flip && "lg:order-1")} delay={0.1} direction={flip ? "right" : "left"} distance={24}>
        <div
          className={cn("animate-blob pointer-events-none absolute -inset-8 -z-10 bg-radial blur-3xl", GLOWS[glow])}
          aria-hidden="true"
        />
        <ProductFrame>
          <div className="rounded-[1.4rem] border border-white/80 bg-white/60 p-2 shadow-floating backdrop-blur sm:p-3">{visual}</div>
        </ProductFrame>
      </Reveal>
    </div>
  );
}
