import { Mail } from "lucide-react";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { DemoRequestForm } from "@/components/demo/demo-request-form";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Request a Demo",
  description: "Tell us about your institution and we'll walk you through the toolkit and how licensing works for your cohort.",
  path: "/demo",
});

export default function DemoPage() {
  return (
    <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-24 sm:pt-32">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Eyebrow>For Universities</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Request a demo</h1>
          <p className="text-lg text-muted-foreground">
            Tell us about your institution and we&apos;ll walk you through the toolkit and how
            licensing works for your cohort.
          </p>
        </div>

        <DemoRequestForm />

        <p className="text-center text-sm text-muted-foreground">
          Prefer email?{" "}
          <a
            href={`mailto:${siteConfig.supportEmail}`}
            className="inline-flex items-center gap-1 text-foreground underline"
          >
            <Mail className="size-3.5" />
            {siteConfig.supportEmail}
          </a>
        </p>
      </div>
    </Section>
  );
}
