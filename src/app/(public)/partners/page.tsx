import { Mail, Layers, BarChart3, Rocket, MessageSquare } from "lucide-react";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { FeatureCard } from "@/components/marketing/feature-card";
import { Faq } from "@/components/marketing/faq";
import { PartnerInquiryForm } from "@/components/partners/partner-inquiry-form";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Partners",
  description:
    "Bring the JobPilot AI toolkit to your careers service, student society, employer network, or bootcamp — bulk access, co-branding, and privacy-safe reporting.",
  path: "/partners",
});

const REASONS = [
  {
    icon: Layers,
    title: "Bulk access",
    description: "Seat-based pricing for your members or cohort, instead of everyone subscribing separately.",
  },
  {
    icon: Rocket,
    title: "Co-branded experience",
    description: "Your organisation's identity stays visible — this isn't a white-label swap-out, it's a partnership.",
  },
  {
    icon: BarChart3,
    title: "Privacy-safe reporting",
    description: "Aggregate usage visibility for your team, without ever seeing an individual member's data.",
  },
  {
    icon: MessageSquare,
    title: "A say in what we build",
    description: "Partner feedback shapes the roadmap — you're not just a distribution channel to us.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Who do you partner with?",
    answer:
      "University careers services, student societies and ambassador programmes, employers, and bootcamps or accelerators supporting a cohort of job seekers.",
  },
  {
    question: "How fast will I hear back?",
    answer: "Within one business day of submitting the form.",
  },
  {
    question: "Is there a minimum cohort size?",
    answer: "No fixed minimum — tell us your numbers and we'll talk through what makes sense.",
  },
];

export default function PartnersPage() {
  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>Partners</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Bring the toolkit to your community
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            For careers services, student societies, employers, and bootcamps supporting people
            through the UK job market.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <FeatureCard key={reason.title} {...reason} />
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Get in touch" title="Tell us about your organisation" />
        <div className="mx-auto mt-8 max-w-xl">
          <PartnerInquiryForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
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

      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions about partnering with us" />
        <div className="mt-8">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>
    </>
  );
}
