import { cn } from "@/lib/utils";

/**
 * A lightweight app-window frame for illustrative product mockups: the
 * title bar, three window dots and a bordered, elevated surface, so a
 * mockup built from real UI pieces reads as "a screen of the product".
 * Purely presentational; anything inside is illustrative, not live data.
 */
export function MockWindow({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-floating", className)}>
      <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-2.5" aria-hidden="true">
        <span className="size-2.5 rounded-full bg-brand-secondary/60" />
        <span className="size-2.5 rounded-full bg-brand-accent/70" />
        <span className="size-2.5 rounded-full bg-success/60" />
        {title && <span className="ml-3 truncate text-xs text-muted-foreground">{title}</span>}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
