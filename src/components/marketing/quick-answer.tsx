import { ZapIcon } from "lucide-react";

export function QuickAnswer({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-2xl items-start gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4 text-sm shadow-card">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <ZapIcon className="size-3.5" />
      </span>
      <p>
        <span className="font-semibold">Quick answer: </span>
        <span className="text-muted-foreground">{children}</span>
      </p>
    </div>
  );
}
