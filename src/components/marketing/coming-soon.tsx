import { Section } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 sm:pt-32">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground">
          Questions?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-foreground underline">
            Get in touch
          </a>
          .
        </p>
      </div>
    </Section>
  );
}
