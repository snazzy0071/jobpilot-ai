import { Container } from "@/components/marketing/container";
import { SectionBackground } from "@/components/backgrounds/section-background";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  default: "bg-background",
  muted: "bg-muted/40",
  primary: "bg-primary text-primary-foreground",
  aurora: "bg-background section-aurora",
  dark: "section-dark",
} as const;

export function Section({
  tone = "default",
  containerClassName,
  className,
  decorative,
  children,
}: {
  tone?: keyof typeof TONE_CLASSES;
  containerClassName?: string;
  className?: string;
  /**
   * The shared grid/glow/floating-shapes background
   * (components/backgrounds/section-background.tsx). Defaults to on
   * for `tone="default"` only — a grid pattern layered on top of an
   * already-colored `muted`/`primary` surface (a CTA block, a feature
   * grid's own card backgrounds) reads as busy rather than premium, so
   * those two tones default to off. Pass `true`/`false` explicitly to
   * override either way.
   */
  decorative?: boolean;
  children: React.ReactNode;
}) {
  const showBackground = decorative ?? tone === "default";

  return (
    <section className={cn("relative py-16 sm:py-24", TONE_CLASSES[tone], className)}>
      {showBackground && <SectionBackground />}
      <Container className={cn("relative", containerClassName)}>{children}</Container>
    </section>
  );
}
