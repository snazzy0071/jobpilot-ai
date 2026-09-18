import { Section } from "@/components/marketing/section";
import { Reveal } from "@/components/motion/reveal";

// Renders on a solid --primary background — pass buttons with a variant
// that contrasts against it (e.g. Button variant="secondary"), not the
// default variant, which is the same color as this background.
export function CtaSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Section tone="primary">
      <Reveal className="flex flex-col items-center gap-4 text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        {description && (
          <p className="max-w-xl text-lg text-primary-foreground/80">{description}</p>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>
      </Reveal>
    </Section>
  );
}
