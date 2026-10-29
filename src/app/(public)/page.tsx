import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Building2, CheckCircle2, CircleDollarSign, GraduationCap, MapPin, MessagesSquare, ShieldCheck, ListChecks, FileText, Wrench, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { Container } from "@/components/marketing/container";
import { HeroBackdrop } from "@/components/marketing/hero-backdrop";
import { ToolMarquee } from "@/components/marketing/tool-marquee";
import { FeatureSplit } from "@/components/marketing/feature-split";
import { SectionHeading } from "@/components/marketing/section-heading";
import { FeatureCard } from "@/components/marketing/feature-card";
import { ToolShowcaseCard } from "@/components/marketing/tool-showcase-card";
import { CtaSection } from "@/components/marketing/cta-section";
import { TrustBar } from "@/components/marketing/trust-bar";
import { CvPreview } from "@/components/marketing/cv-preview";
import { AtsScorePreview } from "@/components/marketing/ats-score-preview";
import { CoverLetterPreview } from "@/components/marketing/cover-letter-preview";
import { InterviewFeedbackPreview } from "@/components/marketing/interview-feedback-preview";
import { JobTrackerPreview } from "@/components/marketing/job-tracker-preview";
import { LinkedInPreview } from "@/components/marketing/linkedin-preview";
import { JobMatchPreview } from "@/components/marketing/job-match-preview";
import { GradPrepPreview } from "@/components/marketing/grad-prep-preview";
import { HeroStage } from "@/components/marketing/home/hero-stage";
import { CvBuilderDemo } from "@/components/marketing/home/cv-builder-demo";
import { AtsScoreDemo } from "@/components/marketing/home/ats-score-demo";
import { SponsorSearchDemo } from "@/components/marketing/home/sponsor-search-demo";
import { JobMatchDemo } from "@/components/marketing/home/job-match-demo";
import { InterviewDemo } from "@/components/marketing/home/interview-demo";
import { PipelineDemo } from "@/components/marketing/home/pipeline-demo";
import { TestPrepDemo } from "@/components/marketing/home/test-prep-demo";
import { HeroStatChips } from "@/components/marketing/hero-stat-chips";
import { JourneySteps, type JourneyStep } from "@/components/marketing/journey-steps";
import { Reveal } from "@/components/motion/reveal";
import { ProductFrame } from "@/components/marketing/product-frame";
import { StatBand } from "@/components/marketing/stat-band";
import { PersonaCards, type Persona } from "@/components/marketing/persona-cards";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { TOOLS } from "@/config/tools";
import { PLAN_LABELS } from "@/config/plans";
import { getTotalSponsorCount } from "@/lib/sponsors/queries";
import { getPublicPlans } from "@/lib/plans/public-plans";
import { minPlanForTool } from "@/lib/plans/plan-features";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  description:
    "The UK career toolkit: a UK-standard CV builder, ATS scanner, interview coach, and a searchable UK visa sponsor register.",
  path: "/",
});

// getTotalSponsorCount() (src/lib/sponsors/queries.ts) now reads through
// createPublicClient() — a plain anon-key client with no cookies — so
// this page no longer gets force-opted into dynamic rendering just for
// that read. ISR instead: the sponsor count only moves when a sync
// completes (a periodic admin job, not per-request), so a 5-minute
// cache is invisible to a real visitor and saves a full server render
// (plus every query on this page) for every repeat/CDN-served hit.
export const revalidate = 300;

// Short, real capability highlights per tool (condensed from each
// FeaturePage's own `capabilities` array) plus the illustrative preview
// component each feature page already uses as its own hero demo — reused
// here, not redrawn, so the homepage never shows a different "product"
// than the page it links to.
const TOOL_SHOWCASE: Record<string, { bullets: string[]; preview: React.ReactNode }> = {
  cv: {
    bullets: ["UK-standard templates", "AI-assisted bullet rewrites", "Built-in ATS pre-check"],
    preview: <CvPreview />,
  },
  ats: {
    bullets: ["Keyword gap analysis", "Section-by-section fix list", "Checked against real ATS platforms"],
    preview: <AtsScorePreview />,
  },
  "cover-letter": {
    bullets: ["Grounded in your real CV", "Regenerate any paragraph", "Pre-send checklist"],
    preview: <CoverLetterPreview />,
  },
  interview: {
    bullets: ["UK-style competency questions", "STAR-structured feedback", "Sector-targeted question packs"],
    preview: <InterviewFeedbackPreview />,
  },
  tracker: {
    bullets: ["Six-stage kanban board", "Sponsor status on every card", "Match-score snapshot per application"],
    preview: <JobTrackerPreview />,
  },
  linkedin: {
    bullets: ["Three headline variants", "Recruiter keyword coverage", "Before/after on every rewrite"],
    preview: <LinkedInPreview />,
  },
  jobmatch: {
    bullets: ["Live UK job listings", "Scored against your CV", "Sponsor status on every listing"],
    preview: <JobMatchPreview />,
  },
  gradprep: {
    bullets: ["Five test formats", "Sector-specific question packs", "Daily streaks & accuracy tracking"],
    preview: <GradPrepPreview />,
  },
};

const JOURNEY: JourneyStep[] = [
  { title: "Build your CV", description: "Start from a UK-standard template and fill in what matters." },
  { title: "Check it against the job", description: "Scan your CV against a specific listing before you apply." },
  { title: "Find roles worth applying to", description: "See matched jobs and sponsor status side by side." },
  { title: "Practise the interview", description: "Work through competency-style questions and get feedback." },
  { title: "Track it to an offer", description: "Follow every application from wishlist to offer." },
];

const BENEFITS = [
  {
    icon: CheckCircle2,
    title: "UK CV conventions",
    description: "A4, two pages, no photo — the format UK recruiters expect, not a US resume.",
  },
  {
    icon: MessagesSquare,
    title: "British-style interviews",
    description: "Competency-based practice, not US-style behavioural formats.",
  },
  {
    icon: ShieldCheck,
    title: "Real sponsor data",
    description: "Sourced from the UK Home Office's public register, not guesswork.",
  },
  {
    icon: MapPin,
    title: "UK-only focus",
    description: "Built specifically for the UK job market, not adapted from somewhere else.",
  },
];

const PERSONAS: Persona[] = [
  { icon: GraduationCap, who: "Final-year students & graduates", need: "Track scheme deadlines, practise the aptitude tests and get a CV that reads well to graduate recruiters.", href: "/graduate-schemes", cta: "Browse graduate schemes" },
  { icon: Landmark, who: "Internationals who need sponsorship", need: "Search the Home Office register of licensed sponsors so you spend time only where an employer can hire you.", href: "/visa-sponsors", cta: "Search the sponsor register" },
  { icon: FileText, who: "Anyone applying now", need: "Find out how a CV scores against a specific job description before you send it, with the top fixes to make first.", href: "/free-ats-checker", cta: "Score my CV free" },
  { icon: Building2, who: "Universities & careers teams", need: "Give a whole cohort the toolkit, with seat management, invites and privacy-safe aggregate analytics.", href: "/for-universities", cta: "See institution plans" },
];

const HOME_FAQ: FaqItem[] = [
  { question: "Is JobPilot AI free?", answer: "Yes. You can start on the Free plan with no card: build a CV, run ATS scans, use the job tracker and search the UK visa sponsor register. Paid plans add more tools and are launching soon; nothing is charged today." },
  { question: "Is the visa sponsor data real?", answer: "Yes. It comes from the UK Home Office's published register of licensed sponsors and is refreshed from gov.uk. A licence shows an employer is allowed to sponsor; it does not guarantee that a particular role is sponsored." },
  { question: "What is a UK-standard CV?", answer: "UK recruiters expect a CV that is normally two pages of A4 with no photo. The CV builder's templates follow those conventions and include an ATS pre-check." },
  { question: "Can I check my CV without an account?", answer: "Yes. The free ATS checker scores a CV against a job description with no signup, and emails you a PDF report. There is a limit of two scans per email address each month." },
  { question: "Do you apply to jobs for me?", answer: "No. JobPilot AI helps you prepare and choose where to apply. Auto-Apply prepares applications for you to review and approve, and hands you the employer's link to apply yourself where a site cannot be applied to by software." },
];

export default async function HomePage() {
  const [sponsorCount, publicPlans] = await Promise.all([getTotalSponsorCount(), getPublicPlans()]);
  // The plan badge on each tool comes from the plans table, not from the marketing config.
  const planBadge = (toolSlug: string, fallback: keyof typeof PLAN_LABELS) => {
    const slug = minPlanForTool(toolSlug, publicPlans) ?? fallback;
    return slug === "free" ? "All plans" : (PLAN_LABELS[slug as keyof typeof PLAN_LABELS] ?? PLAN_LABELS[fallback]);
  };

  return (
    <>
      {/* Hero: light, colourful and animated (client direction 2026-10: no dark sections). */}
      <section className="relative -mt-[68px] overflow-hidden pt-36 pb-20 sm:pt-44 sm:pb-28">
        <HeroBackdrop />
        <Container className="relative">
          <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal className="flex flex-col items-center gap-7 text-center lg:items-start lg:text-left">
              <Link
                href="/free-ats-checker"
                className="group/pill glass inline-flex items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm font-medium shadow-card transition-shadow hover:shadow-elevated"
              >
                <span className="gradient-brand rounded-full px-2.5 py-0.5 text-xs font-semibold text-white">Free</span>
                Score your CV against any UK job
                <ArrowRightIcon className="size-3.5 text-primary transition-transform group-hover/pill:translate-x-0.5" aria-hidden="true" />
              </Link>
              <h1 className="font-heading text-[2.6rem] leading-[1.04] font-bold tracking-tight text-balance sm:text-6xl xl:text-[4.25rem]">
                Everything between your CV and the offer, <span className="text-gradient">handled.</span>
              </h1>
              <p className="max-w-xl text-lg text-pretty text-muted-foreground sm:text-xl">
                {siteConfig.name} builds you a UK-standard CV, scores it against a real job before you apply, and shows you exactly
                which employers can sponsor you. All in one place.
              </p>
              <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
                <Button
                  size="xl"
                  variant="gradient"
                  className="btn-shine group/cta"
                  render={
                    <Link href="/free-ats-checker">
                      Score my CV free
                      <ArrowRightIcon className="transition-transform duration-300 group-hover/cta:translate-x-1" />
                    </Link>
                  }
                />
                <Button size="xl" variant="outline" className="rounded-xl" render={<Link href="/signup">Create free account</Link>} />
              </div>
              <HeroStatChips sponsorCount={sponsorCount} />
            </Reveal>

            <Reveal delay={0.2} direction="left" distance={30} className="pt-8 pb-10 lg:py-0">
              <ProductFrame>
                <HeroStage />
              </ProductFrame>
            </Reveal>
          </div>
        </Container>
      </section>

      {/* Every tool in the product, scrolling */}
      <section className="relative pb-6">
        <Container>
          <p className="mb-5 text-center text-sm font-medium text-muted-foreground">Ten connected tools. One workspace. Built for the UK.</p>
        </Container>
        <ToolMarquee />
        <Container className="mt-6">
          <TrustBar />
        </Container>
      </section>

      {/* Who it's for */}
      <Section tone="aurora">
        <SectionHeading eyebrow="Who it's for" title="Whatever stage of the search you're at" lead="Pick the situation closest to yours and start there. Everything connects." />
        <div className="mt-14">
          <PersonaCards personas={PERSONAS} />
        </div>
      </Section>

      <Section tone="muted" decorative={false}>
        <FeatureSplit
          eyebrow="CV Builder"
          title={<>A CV built for <span className="text-gradient">UK recruiters</span></>}
          lead="UK-standard templates with guided sections and an AI assist for the bullets that are hardest to write."
          bullets={["A4, two pages, no photo", "AI rewrites that keep your facts", "ATS pre-check before you export"]}
          actions={<Button size="lg" render={<Link href="/features/cv">See CV Builder</Link>} />}
          visual={<CvBuilderDemo />}
          glow="blue"
        />
      </Section>

      <Section decorative={false}>
        <FeatureSplit
          flip
          eyebrow="Free tool"
          title={<>Will your CV <span className="text-gradient">beat the bot?</span></>}
          lead="Upload your CV and a job description, no account needed. See the score, the keywords you're missing, and the top fixes to make first."
          bullets={["2 free scans a month, sent to your email as a PDF", "Top 10 matched and missing keywords", "Checked against how major ATS platforms parse a CV"]}
          actions={<Button size="lg" variant="gradient" className="btn-shine" render={<Link href="/free-ats-checker">Score my CV free</Link>} />}
          visual={<AtsScoreDemo />}
          glow="coral"
        />
      </Section>

      <Section tone="aurora" decorative={false}>
        <FeatureSplit
          eyebrow="Visa sponsorship"
          title={<>Only apply where you can <span className="text-gradient">actually be hired</span></>}
          lead="Search the UK Home Office's public register of licensed sponsors before you spend time on an application. A licence doesn't guarantee a specific role is sponsored, but it tells you who's worth asking."
          actions={
            <>
              <Button size="lg" render={<Link href="/visa-sponsors">Search sponsors</Link>} />
              <Button size="lg" variant="outline" render={<Link href="/sponsor-licence-check">Check an employer</Link>} />
            </>
          }
          visual={<SponsorSearchDemo total={sponsorCount} />}
          glow="cyan"
        />
      </Section>

      <Section decorative={false}>
        <FeatureSplit
          flip
          eyebrow="Job Match"
          title={<>See how well a role fits <span className="text-gradient">before you apply</span></>}
          lead="Live UK listings, scored against your CV, with sponsor status on every one, so the roles worth your time float to the top."
          actions={<Button size="lg" render={<Link href="/features/jobmatch">See Job Match</Link>} />}
          visual={<JobMatchDemo />}
          glow="sun"
        />
      </Section>

      <Section tone="muted" decorative={false}>
        <FeatureSplit
          eyebrow="Interview Coach"
          title={<>Practise the answer, <span className="text-gradient">not just the question</span></>}
          lead="UK-style competency questions, with feedback on structure: did you cover the situation, the action and, above all, the result?"
          actions={<Button size="lg" render={<Link href="/features/interview">See Interview Coach</Link>} />}
          visual={<InterviewDemo />}
          glow="blue"
        />
      </Section>

      {/* Application pipeline */}
      <Section>
        <SectionHeading
          eyebrow="Job Tracker"
          title="Every application, on one board"
          lead="From wishlist to offer, with sponsor status and your match score kept on each card."
        />
        <Reveal className="mx-auto mt-12 max-w-3xl" delay={0.1}>
          <PipelineDemo />
        </Reveal>
        <div className="mt-8 flex justify-center">
          <Button variant="outline" render={<Link href="/features/tracker">See Job Tracker</Link>} />
        </div>
      </Section>

      {/* Ten-tool grid */}
      <Section tone="muted">
        <SectionHeading
          eyebrow="Everything included"
          title="Ten tools. One subscription."
          lead="Built to work together, not as ten separate apps to juggle."
        />
        <div className="snap-row -mx-4 mt-12 px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
          {TOOLS.map((tool, index) => (
            <ToolShowcaseCard
              key={tool.slug}
              icon={tool.icon}
              title={tool.title}
              description={tool.shortDescription}
              href={tool.href}
              bullets={TOOL_SHOWCASE[tool.slug]?.bullets ?? []}
              preview={TOOL_SHOWCASE[tool.slug]?.preview}
              planBadge={planBadge(tool.slug, tool.plan)}
              index={index}
            />
          ))}
          <ToolShowcaseCard
            icon={ShieldCheck}
            title="Visa Sponsor Register"
            description="Search the UK Home Office's licensed sponsor register."
            href="/visa-sponsors"
            bullets={["Full Home Office register", "Filter by route & location", "Synced from gov.uk"]}
            planBadge="All plans"
            index={TOOLS.length}
          />
          <ToolShowcaseCard
            icon={Building2}
            title="Sponsor Licence Check"
            description="Check a specific employer's sponsor status."
            href="/sponsor-licence-check"
            bullets={["Check one employer instantly", "Real register lookup", "No account needed"]}
            planBadge="All plans"
            index={TOOLS.length + 1}
          />
          <Reveal className="h-full lg:col-span-2" delay={0.2}>
            <Link
              href="/go"
              className="gradient-brand group relative flex h-full min-h-56 flex-col justify-between gap-6 overflow-hidden rounded-2xl p-7 text-white shadow-glow transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="animate-blob pointer-events-none absolute -top-16 -right-10 size-56 bg-brand-cyan/50 blur-3xl" aria-hidden="true" />
              <div className="animate-blob pointer-events-none absolute -bottom-20 left-10 size-48 bg-brand-coral/40 blur-3xl [animation-delay:-8s]" aria-hidden="true" />
              <div className="relative flex flex-col gap-2">
                <p className="text-xs font-semibold tracking-widest text-white/85 uppercase">Not sure where to start?</p>
                <h3 className="font-heading text-2xl font-semibold tracking-tight text-balance">Tell us your situation and we&apos;ll point you to the right tool</h3>
              </div>
              <span className="relative inline-flex items-center gap-1 text-sm font-semibold">
                Find my starting point
                <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
              </span>
            </Link>
          </Reveal>
        </div>
      </Section>

      <StatBand
        eyebrow="The toolkit in numbers"
        title="Real data, one workspace"
        items={[
          { icon: ShieldCheck, value: sponsorCount > 0 ? sponsorCount : "Live", suffix: sponsorCount > 0 ? "+" : undefined, label: "Licensed UK sponsors", caption: "From the Home Office register, synced from gov.uk" },
          { icon: Wrench, value: TOOLS.length + 2, label: "Tools in one place", caption: "CV, ATS, cover letters, interviews, tracker and more" },
          { icon: ListChecks, value: 5, label: "Aptitude test formats", caption: "Original practice questions with explanations" },
          { icon: CircleDollarSign, value: "£0", label: "To start", caption: "Free plan, no card required" },
        ]}
      />

      {/* Grad-prep spotlight */}
      <Section decorative={false}>
        <FeatureSplit
          eyebrow="Graduate schemes"
          title={<>Practise the tests, <span className="text-gradient">not just the interview</span></>}
          lead="Numerical, verbal and situational judgement practice in the formats graduate schemes actually use, with original questions and daily streaks to keep you on track."
          actions={<Button size="lg" render={<Link href="/features/gradprep">See Grad Scheme Prep</Link>} />}
          visual={<TestPrepDemo />}
          glow="coral"
        />
      </Section>

      {/* Five-step journey */}
      <Section tone="aurora">
        <SectionHeading eyebrow="How it works" title="From CV to offer" />
        <div className="mt-12">
          <JourneySteps steps={JOURNEY} />
        </div>
      </Section>

      {/* UK-first benefits */}
      <Section>
        <SectionHeading eyebrow="Built for the UK" title="Built around how UK hiring actually works" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit, index) => (
            <FeatureCard key={benefit.title} {...benefit} index={index} />
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions people ask first" />
        <div className="mt-12">
          <Faq items={HOME_FAQ} />
        </div>
      </Section>

      {/* Closing CTA */}
      <CtaSection
        title="Ready to get started?"
        description="Create a free account and see how your CV scores today."
        points={["No card required", "UK-format CVs", "Real Home Office sponsor data"]}
      >
        <Button size="xl" variant="secondary" className="bg-white text-primary shadow-floating hover:bg-white hover:-translate-y-0.5" render={<Link href="/signup">Create free account</Link>} />
        <Button size="xl" variant="ghost" className="border border-white/50 text-white hover:bg-white/15 hover:text-white" render={<Link href="/free-ats-checker">Score my CV free</Link>} />
      </CtaSection>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: siteConfig.name,
          url: siteConfig.domain,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: "UK career toolkit: CV builder, ATS scanner, interview coach, job tracker and a searchable UK visa sponsor register.",
          areaServed: "GB",
          offers: { "@type": "Offer", price: "0", priceCurrency: "GBP", description: "Free plan" },
        }}
      />
    </>
  );
}
