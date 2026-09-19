import Link from "next/link";
import {
  BadgeCheckIcon,
  FileTextIcon,
  FlagIcon,
  MessagesSquareIcon,
  ScanSearchIcon,
  ScaleIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { FloatingCardStack } from "@/components/marketing/floating-card-stack";
import { MockWindow } from "@/components/marketing/mock-window";
import { FeatureCard } from "@/components/marketing/feature-card";
import { CtaSection } from "@/components/marketing/cta-section";
import { Reveal } from "@/components/motion/reveal";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { StaggerItem } from "@/components/motion/stagger-item";
import { siteConfig } from "@/config/site";
import { TOOLS } from "@/config/tools";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "About",
  description:
    "JobPilot AI puts UK CV formatting, ATS checking, interview practice, and visa sponsor data in one place, instead of five separate tools.",
  path: "/about",
});

const PRINCIPLES = [
  {
    icon: FlagIcon,
    title: "Built for the UK",
    description:
      "UK-standard CV formatting, applicant tracking systems and competency interviews are the starting point, not an afterthought.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Honest about our data",
    description:
      "Sponsor data comes from the UK Home Office's public register. We show where it's from and tell you to verify with the employer.",
  },
  {
    icon: ScaleIcon,
    title: "Independent",
    description: `${siteConfig.name} isn't affiliated with any recruiter, employer or visa sponsor, so nothing nudges you toward one.`,
  },
];

const SCATTERED = ["CV builder", "ATS checker", "gov.uk sponsor list", "Interview prep", "Spreadsheet tracker"];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={
          <>
            One place for the <GradientText>UK job hunt</GradientText>
          </>
        }
        description={`${siteConfig.name} puts the parts of applying for work in the UK that actually matter in one place, instead of a tab for each.`}
        actions={
          <>
            <Button size="lg" variant="gradient" render={<Link href="/signup">Get started free</Link>} />
            <Button size="lg" variant="outline" render={<Link href="/features/cv">Explore the tools</Link>} />
          </>
        }
        visual={
          <FloatingCardStack
            items={[
              { icon: FileTextIcon, title: "UK-standard CVs", caption: "A4, two pages, no photo" },
              { icon: ScanSearchIcon, title: "ATS checking", caption: "Scored against the real job", tone: "coral" },
              { icon: BadgeCheckIcon, title: "Sponsor register", caption: "Home Office data, searchable", tone: "success" },
              { icon: MessagesSquareIcon, title: "Interview practice", caption: "Competency-style questions", tone: "accent" },
            ]}
          />
        }
      />

      <Section tone="muted" decorative>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="flex flex-col gap-5">
            <SectionHeading
              align="left"
              eyebrow="Why we exist"
              title="Job hunting shouldn't need five tabs"
            />
            <p className="text-muted-foreground">
              Job hunting in the UK involves more separate tools than it should: a CV builder
              here, an ATS checker there, and a visa sponsor list you have to dig for on gov.uk.
              {" "}{siteConfig.name} puts the parts that actually matter in one place.
            </p>
            <p className="text-muted-foreground">
              We&apos;re building this for anyone applying for work in the UK, with particular
              attention to the parts that are hardest to get right from outside the system:
              UK-standard CV formatting, applicant tracking systems, and knowing which employers
              can genuinely sponsor a visa before you spend time applying.
            </p>
          </Reveal>

          <Reveal delay={0.15} direction="left" distance={24}>
            <MockWindow title={`${siteConfig.name} · workspace`}>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Instead of</p>
                <div className="flex flex-wrap gap-2">
                  {SCATTERED.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground line-through decoration-muted-foreground/40"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div className="gradient-brand my-1 h-px w-full opacity-60" aria-hidden="true" />
                <p className="text-xs font-medium tracking-wide text-primary uppercase">One workspace</p>
                <div className="grid grid-cols-2 gap-2">
                  {TOOLS.slice(0, 4).map((tool) => (
                    <div key={tool.slug} className="flex items-center gap-2 rounded-xl border bg-background p-3">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <tool.icon className="size-4" />
                      </span>
                      <span className="text-xs font-medium">{tool.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            </MockWindow>
          </Reveal>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="What guides us" title="Three things we won't compromise on" />
        <StaggerContainer className="mt-12 grid gap-6 md:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <StaggerItem key={principle.title} className="h-full">
              <FeatureCard {...principle} />
            </StaggerItem>
          ))}
        </StaggerContainer>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="The toolkit"
          title="Everything in one workspace"
          lead="Each tool works on its own and gets better alongside the others."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool, index) => (
            <FeatureCard
              key={tool.slug}
              icon={tool.icon}
              title={tool.title}
              description={tool.shortDescription}
              href={tool.href}
              index={index}
            />
          ))}
        </div>
      </Section>

      <Section>
        <Reveal className="mx-auto flex max-w-3xl items-start gap-4 rounded-2xl border border-brand-accent/40 bg-brand-accent/10 p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-accent/30 text-foreground">
            <TriangleAlertIcon className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-semibold">A note on sponsor data</p>
            <p className="text-sm text-muted-foreground">
              {siteConfig.name} is an independent product. Our visa sponsor data comes from the UK
              Home Office&apos;s public register. Always verify sponsorship directly with an
              employer before relying on it.
            </p>
          </div>
        </Reveal>
      </Section>

      <CtaSection title="See what one workspace feels like" description="Create a free account. No card required.">
        <Button size="lg" variant="secondary" render={<Link href="/signup">Create free account</Link>} />
        <Button
          size="lg"
          variant="ghost"
          className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
          render={<Link href="/contact">Talk to us</Link>}
        />
      </CtaSection>
    </>
  );
}
