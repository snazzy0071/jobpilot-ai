import { ClockIcon, LifeBuoyIcon, LightbulbIcon, Mail } from "lucide-react";
import { SplitFormPage } from "@/components/marketing/split-form-page";
import { GradientText } from "@/components/marketing/gradient-text";
import { ContactForm } from "@/components/contact/contact-form";
import { siteConfig } from "@/config/site";
import { JsonLd } from "@/components/seo/json-ld";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Contact",
  description: "Questions, feedback, or something not working? Send us a message and a real person will get back to you.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <>
    <JsonLd data={{ "@context": "https://schema.org", "@type": "ContactPage", name: `Contact ${siteConfig.name}`, url: `${siteConfig.domain}/contact`, isPartOf: { "@id": `${siteConfig.domain}/#website` } }} />
    <SplitFormPage
      eyebrow="Contact"
      title={
        <>
          Let&apos;s <GradientText>talk</GradientText>
        </>
      }
      description="Questions, feedback, or something not working? Send us a message and a real person will get back to you."
      points={[
        { icon: LifeBuoyIcon, title: "Something not working?", description: "Tell us what you were doing and what you saw, and we'll dig in." },
        { icon: LightbulbIcon, title: "Ideas and feedback", description: "Missing a tool or a template? We read every suggestion." },
        { icon: ClockIcon, title: "A real person replies", description: "No bots on the other end of this form." },
      ]}
      form={<ContactForm />}
      formTitle="Send us a message"
      formNote={
        <>
          Prefer email?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="inline-flex items-center gap-1 text-foreground underline">
            <Mail className="size-3.5" />
            {siteConfig.supportEmail}
          </a>
        </>
      }
    />
    </>
  );
}
