import { cn } from "@/lib/utils";

/** Small pill label above a heading, with a pulsing colour dot. */
export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-primary uppercase shadow-[0_2px_10px_-2px_rgba(51,80,255,0.18)] backdrop-blur",
        className,
      )}
    >
      <span className="relative flex size-1.5" aria-hidden="true">
        <span className="animate-ping-soft absolute inline-flex size-full rounded-full bg-brand-coral" />
        <span className="relative inline-flex size-1.5 rounded-full bg-brand-coral" />
      </span>
      {children}
    </span>
  );
}
