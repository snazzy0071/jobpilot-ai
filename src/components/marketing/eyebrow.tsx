import { cn } from "@/lib/utils";

export function Eyebrow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "text-xs font-semibold tracking-widest text-primary uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}
