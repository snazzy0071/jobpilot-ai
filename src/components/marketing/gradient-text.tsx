import { cn } from "@/lib/utils";

/** Brand-gradient emphasis for one phrase inside a headline. Large text only. */
export function GradientText({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("gradient-brand bg-clip-text text-transparent", className)}>{children}</span>;
}
