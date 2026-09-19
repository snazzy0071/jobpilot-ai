import { ArrowRightIcon, SparklesIcon, XIcon } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";

export function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="mx-auto grid max-w-4xl items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
      <Reveal direction="right" className="flex flex-col gap-3 rounded-2xl border bg-muted/40 p-6">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <XIcon className="size-3" />
          </span>
          Before
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">{before}</p>
      </Reveal>

      <div className="flex items-center justify-center" aria-hidden="true">
        <span className="gradient-brand flex size-10 rotate-90 items-center justify-center rounded-full text-white shadow-elevated md:rotate-0">
          <ArrowRightIcon className="size-4" />
        </span>
      </div>

      <Reveal
        direction="left"
        delay={0.1}
        className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-primary/40 bg-primary/5 p-6 shadow-elevated"
      >
        <div className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-primary/10 blur-2xl" aria-hidden="true" />
        <p className="relative flex items-center gap-2 text-xs font-medium tracking-wide text-primary uppercase">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-primary">
            <SparklesIcon className="size-3" />
          </span>
          After
        </p>
        <p className="relative text-sm leading-relaxed">{after}</p>
      </Reveal>
    </div>
  );
}
