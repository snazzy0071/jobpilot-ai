import Link from "next/link";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { tileGradient } from "@/components/marketing/tile-colors";

export type Persona = { icon: LucideIcon; who: string; need: string; href: string; cta: string };

/** "Who is this for?" cards: each one is a real route, so a visitor can jump straight to the tool that fits their situation. */
export function PersonaCards({ personas }: { personas: Persona[] }) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", personas.length === 3 && "lg:grid-cols-3", personas.length >= 4 && "lg:grid-cols-4")}>
      {personas.map((persona, index) => (
        <Reveal key={persona.who} delay={Math.min(index * 0.07, 0.3)} className="h-full">
          <Link
            href={persona.href}
            className="card-sheen group flex h-full flex-col gap-3 rounded-3xl border border-white bg-white/80 p-7 shadow-elevated backdrop-blur focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className={cn("flex size-12 items-center justify-center rounded-2xl text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110", tileGradient(index))}>
              <persona.icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="mt-2 font-heading text-lg font-bold">{persona.who}</h3>
            <p className="flex-1 text-sm text-muted-foreground">{persona.need}</p>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              {persona.cta}
              <ArrowRightIcon className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
            </span>
          </Link>
        </Reveal>
      ))}
    </div>
  );
}
