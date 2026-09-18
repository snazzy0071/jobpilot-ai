import { cn } from "@/lib/utils";

const STEPS = ["About you", "What you want", "Logistics"];

export function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Onboarding progress">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const active = step === current;
        const done = step < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                active && "bg-primary text-primary-foreground",
                done && "bg-muted text-foreground",
                !active && !done && "bg-muted text-muted-foreground",
              )}
            >
              {step}
            </span>
            <span className={cn("text-sm", active ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            {step < STEPS.length && <span className="mx-1 text-muted-foreground">&middot;</span>}
          </li>
        );
      })}
    </ol>
  );
}
