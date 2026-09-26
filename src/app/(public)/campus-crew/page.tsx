import Link from "next/link";
import { GraduationCap, Megaphone, Users, Handshake, ClipboardCheck, Mail } from "lucide-react";
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
import { CampusCrewForm } from "@/components/campus-crew/campus-crew-form";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Campus Crew",
  description: "Apply to be a JobPilot AI student ambassador: help classmates find CV, ATS and visa sponsorship tools that work for the UK job market.",
  path: "/campus-crew",
});

const POINTS = [
  { icon: Users, title: "Your campus, your way", description: "You know which societies, cohorts and channels your classmates actually pay attention to." },
  { icon: Megaphone, title: "Help people find the tools", description: "Introduce the CV builder, the ATS checker and the sponsor register to people who are about to need them." },
  { icon: Handshake, title: "Clear terms first", description: "If we would like to work together, we explain exactly what is involved before you commit to anything." },
];

const STEPS = [
  { icon: ClipboardCheck, title: "Apply below", description: "Tell us about your course and why you would like to do this. It takes a few minutes." },
  { icon: Mail, title: "We read every application", description: "A person on our team reads it and emails you if we would like to talk." },
  { icon: GraduationCap, title: "A conversation", description: "We talk through what the role involves and whether it suits you." },
];

const FAQ_ITEMS = [
  { question: "Who can apply?", answer: "Anyone currently studying at a UK university or college. We are especially interested in students who are active in a society, course group or careers network." },
  { question: "Is it paid?", answer: "We do not publish terms here because they are agreed one to one. If we take your application forward we set them out in writing before you commit to anything." },
  { question: "What do you do with my details?", answer: "We use them only to consider your application and to contact you about it. You can ask us to delete them at any time, and they are removed if you delete a JobPilot AI account with the same email address." },
];

export default function CampusCrewPage() {
  return (
    <>
      <PageHero
        eyebrow="Campus Crew"
        title={
          <>
            Be the student people ask about <GradientText>the job search</GradientText>
          </>
        }
        description="Apply to represent JobPilot AI on your campus: help classmates get their CV, applications and visa questions in order."
        actions={
          <>
            <Button size="lg" variant="gradient" render={<a href="#apply">Apply now</a>} />
            <Button size="lg" variant="outline" render={<Link href="/partners">Partner with us instead</Link>} />
          </>
        }
        visual={
          <FloatingCardStack
            items={[
              { icon: GraduationCap, title: "Student ambassadors", caption: "On campuses across the UK", tone: "primary" },
              { icon: Users, title: "Societies and cohorts", caption: "Where your peers already are", tone: "coral" },
              { icon: Megaphone, title: "Useful, not pushy", caption: "Tools people actually need", tone: "success" },
            ]}
          />
        }
      />

      <Section tone="muted">
        <SectionHeading eyebrow="The role" title="What being on the Campus Crew means" />
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-3">
          {POINTS.map((point, index) => (
            <FeatureCard key={point.title} {...point} index={index} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="How it works" title="From application to conversation" />
        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <FeatureCard key={step.title} {...step} index={index} />
          ))}
        </div>
      </Section>

      <div id="apply" className="scroll-mt-16">
        <SplitFormPage
          asSection
          eyebrow="Apply"
          title="Tell us about you and your campus"
          description="We read every application. If we would like to talk, we will email you."
          form={<CampusCrewForm />}
          formNote={
            <>
              Questions first?{" "}
              <a href={`mailto:${siteConfig.supportEmail}`} className="inline-flex items-center gap-1 text-foreground underline">
                <Mail className="size-3.5" />
                {siteConfig.supportEmail}
              </a>
            </>
          }
        />
      </div>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions about the Campus Crew" />
        <div className="mt-12">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaSection title="Represent a whole organisation?" description="Careers services, societies and employers can partner with us.">
        <Button size="lg" variant="secondary" render={<Link href="/partners">Become a partner</Link>} />
      </CtaSection>
    </>
  );
}
