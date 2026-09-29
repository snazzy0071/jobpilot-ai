import Link from "next/link";
import { CalculatorIcon, ScaleIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { FloatingCardStack } from "@/components/marketing/floating-card-stack";
import { CtaSection } from "@/components/marketing/cta-section";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Faq } from "@/components/marketing/faq";
import { GENERAL_THRESHOLD, GOING_RATES_URL, RATE_CATEGORIES, RATE_RULES, SOURCES, VERIFIED_ON, type RateCategory } from "@/config/skilled-worker";
import { checkSalary, formatPounds, parsePounds } from "@/lib/skilled-worker/calculate";
import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata = buildMetadata({
  title: "Skilled Worker Salary Calculator",
  description: "Check a job offer against the UK Skilled Worker visa salary rules: the general threshold, the going rate and the reduced rates for new entrants and PhD holders.",
  path: "/skilled-worker-salary-calculator",
});

const FAQ_ITEMS = [
  {
    question: "Where do the figures come from?",
    answer: `They are copied from the Home Office's own GOV.UK guidance, which is linked below the calculator, and were last checked on ${new Date(VERIFIED_ON).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}. The rules change, so always confirm on GOV.UK before you rely on a number.`,
  },
  {
    question: "What is the going rate?",
    answer: "Each occupation code has its own going rate in the Home Office's table. The salary must be at least the higher of the general threshold and the going rate (or the share of it that applies to you). Look your job's code up in the official table and type its annual figure in.",
  },
  {
    question: "Does meeting the salary mean I qualify for a visa?",
    answer: "No. Salary is one requirement. The job must be eligible, the employer must hold a sponsor licence and issue a certificate of sponsorship, and you must meet the other rules. This is a guide, not immigration advice.",
  },
];

type SearchParams = { salary?: string; goingRate?: string; category?: string };

function readCategory(value: string | undefined): RateCategory {
  return RATE_CATEGORIES.includes(value as RateCategory) ? (value as RateCategory) : "standard";
}

export default async function SkilledWorkerSalaryCalculatorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const category = readCategory(params.category);
  const submitted = params.salary !== undefined;
  const salary = parsePounds(params.salary);
  const goingRateTyped = (params.goingRate ?? "").trim() !== "";
  const goingRate = parsePounds(params.goingRate);
  const salaryError = submitted && salary === null ? "Enter your annual salary as a number of pounds, for example 45000." : null;
  const goingRateError = goingRateTyped && goingRate === null ? "Enter the going rate as a number of pounds a year, or leave it blank." : null;
  const result = salary !== null && !goingRateError ? checkSalary({ salary, goingRate, category }) : null;
  const rule = RATE_RULES[category];

  return (
    <>
      <PageHero
        eyebrow="Free tool"
        title={
          <>
            Skilled Worker <GradientText>salary calculator</GradientText>
          </>
        }
        description="Check a UK job offer against the Skilled Worker visa salary rules, including the reduced rates for new entrants and PhD holders."
        actions={<Button size="lg" variant="gradient" render={<a href="#calculator">Check a salary</a>} />}
        visual={
          <FloatingCardStack
            items={[
              { icon: CalculatorIcon, title: "Enter the offer", caption: "Annual salary in pounds", tone: "primary" },
              { icon: ScaleIcon, title: "Compared with the rules", caption: "Threshold and going rate", tone: "coral" },
              { icon: ShieldCheckIcon, title: "Sourced from GOV.UK", caption: "With the date it was checked", tone: "success" },
            ]}
          />
        }
      />

      <Section className="pt-0">
        <div id="calculator" className="mx-auto flex max-w-2xl scroll-mt-20 flex-col gap-6">
          <Card className="p-6 sm:p-8">
            <form method="GET" action="/skilled-worker-salary-calculator#result" className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-2">
                <label htmlFor="salary" className="text-sm font-medium">
                  Annual salary offered (£)
                </label>
                <Input id="salary" name="salary" inputMode="decimal" autoComplete="off" placeholder="e.g. 45,000" defaultValue={params.salary ?? ""} aria-invalid={salaryError ? true : undefined} aria-describedby={salaryError ? "salary-error" : undefined} required />
                {salaryError && (
                  <p id="salary-error" role="alert" className="text-sm text-destructive">
                    {salaryError}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="category" className="text-sm font-medium">
                  Which rate applies to you?
                </label>
                <NativeSelect id="category" name="category" defaultValue={category}>
                  {RATE_CATEGORIES.map((key) => (
                    <option key={key} value={key}>
                      {RATE_RULES[key].label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{rule.who}</p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="goingRate" className="text-sm font-medium">
                  Going rate for the job (£ a year), if you know it
                </label>
                <Input id="goingRate" name="goingRate" inputMode="decimal" autoComplete="off" placeholder="From the official going rates table" defaultValue={params.goingRate ?? ""} aria-invalid={goingRateError ? true : undefined} aria-describedby={goingRateError ? "going-rate-error" : "going-rate-help"} />
                {goingRateError ? (
                  <p id="going-rate-error" role="alert" className="text-sm text-destructive">
                    {goingRateError}
                  </p>
                ) : (
                  <p id="going-rate-help" className="text-xs text-muted-foreground">
                    Find your job&apos;s occupation code in the{" "}
                    <a href={GOING_RATES_URL} target="_blank" rel="noopener noreferrer" className="underline">
                      official going rates table
                    </a>
                    . Without it we can only tell you if the salary is too low.
                  </p>
                )}
              </div>

              <Button type="submit" size="lg" className="self-start">
                Check this salary
              </Button>
            </form>
          </Card>

          <div id="result" className="scroll-mt-20">
            {result && salary !== null && (
              <Card className="gap-3 p-6 sm:p-8" role="status" aria-live="polite" data-result={result.meets === null ? "unconfirmed" : result.meets ? "meets" : "below"}>
                <h2 className="font-heading text-xl font-semibold tracking-tight">
                  {result.meets === true && "This salary meets the minimum"}
                  {result.meets === false && "This salary is below the minimum"}
                  {result.meets === null && "Above the floor, but the going rate decides"}
                </h2>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Salary offered</dt>
                    <dd className="font-medium">{formatPounds(salary)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{result.goingRateNeeded ? "Lowest it can be for this rate" : "Minimum that applies"}</dt>
                    <dd className="font-medium">{formatPounds(result.required)}</dd>
                  </div>
                  {result.fromGoingRate !== null && (
                    <div>
                      <dt className="text-muted-foreground">{rule.goingRateShare === 1 ? "Going rate" : `${Math.round(rule.goingRateShare * 100)}% of the going rate`}</dt>
                      <dd className="font-medium">{formatPounds(result.fromGoingRate)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-muted-foreground">Lowest possible for this rate</dt>
                    <dd className="font-medium">{formatPounds(result.floor)}</dd>
                  </div>
                </dl>
                {result.meets === false && result.shortfall > 0 && <p className="text-sm">It is {formatPounds(result.shortfall)} a year short.</p>}
                {result.meets === null && <p className="text-sm">Add the going rate for the job to find out whether {formatPounds(salary)} is enough.</p>}
                {category === "standard" && result.goingRateNeeded && (
                  <p className="text-xs text-muted-foreground">The general threshold is {formatPounds(GENERAL_THRESHOLD)}; the going rate can be higher.</p>
                )}
              </Card>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Figures last checked on {new Date(VERIFIED_ON).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} against{" "}
            {SOURCES.map((source, index) => (
              <span key={source.href}>
                {index > 0 && " and "}
                <a href={source.href} target="_blank" rel="noopener noreferrer" className="underline">
                  {source.label}
                </a>
              </span>
            ))}
            . This is a guide, not immigration advice; the Home Office decides. It does not cover every reduced-rate case (for example prison officers or health and education roles), and hourly and working-hours rules are not checked.
          </p>
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions about the salary rules" />
        <div className="mt-12">
          <Faq items={FAQ_ITEMS} />
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
          Questions?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="underline">
            Get in touch
          </a>
          .
        </p>
      </Section>

      <CtaSection title="Is the employer a licensed sponsor?" description="Salary is only one requirement. Check the employer against the Home Office register.">
        <Button size="lg" variant="secondary" render={<Link href="/sponsor-licence-check">Check an employer</Link>} />
      </CtaSection>
    </>
  );
}
