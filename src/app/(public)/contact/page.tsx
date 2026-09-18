import { Mail } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { ContactForm } from "@/components/contact/contact-form";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Contact",
  description: "Questions, feedback, or something not working? Send us a message and a real person will get back to you.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-24 sm:pt-32">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Eyebrow>Contact</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">Get in touch</h1>
          <p className="text-lg text-muted-foreground">
            Questions, feedback, or something not working? Send us a message and a real person
            will get back to you.
          </p>
        </div>

        <ContactForm />

        <p className="text-center text-sm text-muted-foreground">
          Prefer email?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="inline-flex items-center gap-1 text-foreground underline">
            <Mail className="size-3.5" />
            {siteConfig.supportEmail}
          </a>
        </p>
      </div>
    </Section>
  );
}
