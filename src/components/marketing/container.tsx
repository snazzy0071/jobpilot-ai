import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  // Section backgrounds/decorations are already full-bleed (Section renders the tone color on the outer <section>,
  // not here) — this cap is just for readable text/card-grid width. Widened from max-w-6xl (1152px) per the client's
  // "full width" note: content now uses the screen much more generously on large monitors, backgrounds always did.
  return <div className={cn("mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-10", className)}>{children}</div>;
}
