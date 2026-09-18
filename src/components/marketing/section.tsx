import { Container } from "@/components/marketing/container";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  default: "bg-background",
  muted: "bg-muted/40",
  primary: "bg-primary text-primary-foreground",
} as const;

export function Section({
  tone = "default",
  containerClassName,
  className,
  children,
}: {
  tone?: keyof typeof TONE_CLASSES;
  containerClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("py-16 sm:py-24", TONE_CLASSES[tone], className)}>
      <Container className={containerClassName}>{children}</Container>
    </section>
  );
}
