import Link from "next/link";
import { Mail, Layers, BarChart3, Rocket, MessageSquare, GraduationCap, Users, Building2, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { FloatingCardStack } from "@/components/marketing/floating-card-stack";
import { SplitFormPage } from "@/components/marketing/split-form-page";
import { CtaSection } from "@/components/marketing/cta-section";
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
      <PageHero
        eyebrow="Partners"
        title={
          <>
            Bring the toolkit to <GradientText>your community</GradientText>
          </>
        }
        description="For careers services, student societies, employers, and bootcamps supporting people through the UK job market."
        actions={
          <>
            <Button size="lg" variant="gradient" render={<a href="#partner-form">Become a partner</a>} />
            <Button size="lg" variant="outline" render={<Link href="/for-universities">For universities</Link>} />
          </>
        }
        visual={
          <FloatingCardStack
            items={[
              { icon: GraduationCap, title: "Careers services", caption: "Support a whole cohort", tone: "primary" },
              { icon: Users, title: "Student societies", caption: "Ambassador programmes", tone: "coral" },
              { icon: Building2, title: "Employers", caption: "Help candidates prepare", tone: "success" },
              { icon: Code2, title: "Bootcamps", caption: "Accelerators and cohorts", tone: "accent" },
            ]}
          />
        }
      />

      <Section tone="muted">
        <SectionHeading eyebrow="Why partner" title="Built around how communities actually work" />
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
          {REASONS.map((reason, index) => (
            <FeatureCard key={reason.title} {...reason} index={index} />
          ))}
        </div>
      </Section>

      <div id="partner-form" className="scroll-mt-16">
        <SplitFormPage
          asSection
          eyebrow="Get in touch"
          title="Tell us about your organisation"
          description="Within one business day of submitting the form, a real person will reply to talk through what makes sense for your numbers."
          form={<PartnerInquiryForm />}
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
      </div>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions about partnering with us" />
        <div className="mt-12">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaSection title="Not sure it fits? Ask us." description="Tell us your numbers and we'll talk through options.">
        <Button size="lg" variant="secondary" render={<Link href="/contact">Contact us</Link>} />
      </CtaSection>
    </>
  );
}
