import Link from "next/link";
import { AlertTriangle, Check, CircleHelp, ExternalLink, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { Faq } from "@/components/marketing/faq";
import { collectSources, hostOf } from "@/lib/comparisons/sources";
import { SUPPORT_LABELS, type ComparisonPage, type JobpilotLevel, type SupportLevel } from "@/lib/comparisons/types";
import { isStale, STALE_AFTER_DAYS } from "@/lib/graduate-schemes/staleness";

export function formatCheckedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** A yes/partly/no mark that never relies on colour or an icon alone: the words are always there. */
function Mark({ level, label }: { level: SupportLevel | JobpilotLevel; label: string }) {
  const Icon = level === "yes" ? Check : level === "no" ? Minus : level === "partial" ? Minus : CircleHelp;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium" data-level={level}>
      <Icon className={`size-4 ${level === "yes" ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function SourceRef({ number }: { number: number | null }) {
  if (number === null) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <a href={`#source-${number}`} className="text-xs font-medium text-primary underline" aria-label={`Source ${number}`} data-testid="source-ref">
      [{number}]
    </a>
  );
}

/**
 * The comparison itself: everything on it is either about JobPilot AI (our own product) or about the competitor with a numbered
 * source beside it. Used by the public page and the admin's draft preview, so what an admin previews is what readers get.
 */
export function ComparisonView({ page }: { page: ComparisonPage }) {
  const { sources, numberFor } = collectSources(page);
  const name = page.competitorName;
  const stale = isStale(page.updatedOn);

  return (
    <>
      <Section className="pt-0">
        <div className="mx-auto flex max-w-4xl flex-col gap-10" data-testid="comparison">
          <div className="flex flex-col gap-3" data-testid="checked">
            <p className="text-sm text-muted-foreground">
              Information about {name} checked on <strong data-testid="checked-date">{formatCheckedDate(page.updatedOn)}</strong>.
              {page.competitorWebsite && (
                <>
                  {" "}
                  <a href={page.competitorWebsite} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 underline">
                    {hostOf(page.competitorWebsite)} <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </>
              )}
            </p>
            {stale && (
              <p className="flex items-center gap-1.5 text-sm text-warning" data-testid="stale-warning">
                <AlertTriangle className="size-4" aria-hidden="true" /> This hasn&apos;t been rechecked in over {STALE_AFTER_DAYS} days, so {name}&apos;s features or prices may have changed — check its own site.
              </p>
            )}
            {page.intro && <p className="text-base leading-relaxed" data-testid="intro">{page.intro}</p>}
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground" data-testid="disclosure">
              JobPilot AI is a competing product, so this is our view. Every statement about {name} below links to the public page it came from and the date we checked it; anything we couldn&apos;t confirm says so rather than guessing.
            </p>
          </div>

          {page.features.length > 0 && (
            <section aria-labelledby="features-heading" data-testid="features">
              <h2 id="features-heading" className="mb-4 font-heading text-2xl font-semibold tracking-tight">
                Features side by side
              </h2>
              <div className="overflow-x-auto rounded-2xl border bg-card shadow-card">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th scope="col" className="p-4 font-medium text-muted-foreground">Feature</th>
                      <th scope="col" className="p-4 font-semibold">{name}</th>
                      <th scope="col" className="bg-primary/5 p-4 font-semibold text-primary">JobPilot AI</th>
                      <th scope="col" className="p-4 font-medium text-muted-foreground">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.features.map((feature) => (
                      <tr key={feature.label} className="border-b last:border-0" data-testid="feature-row">
                        <th scope="row" className="p-4 font-normal">{feature.label}</th>
                        <td className="p-4 align-top" data-testid="competitor-cell">
                          <Mark level={feature.competitor} label={SUPPORT_LABELS[feature.competitor]} />
                          {feature.competitorNote && <p className="mt-1 text-xs text-muted-foreground">{feature.competitorNote}</p>}
                        </td>
                        <td className="bg-primary/5 p-4 align-top" data-testid="jobpilot-cell">
                          <Mark level={feature.jobpilot} label={feature.jobpilot === "yes" ? "Yes" : feature.jobpilot === "partial" ? "Partly" : "No"} />
                          {feature.jobpilotNote && <p className="mt-1 text-xs text-muted-foreground">{feature.jobpilotNote}</p>}
                        </td>
                        <td className="p-4 align-top">
                          <SourceRef number={numberFor(feature.sourceUrl)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {page.pricing.length > 0 && (
            <section aria-labelledby="pricing-heading" data-testid="pricing">
              <h2 id="pricing-heading" className="mb-1 font-heading text-2xl font-semibold tracking-tight">
                Pricing notes
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">
                As {name} published them on the date shown — prices change, so confirm on its site. JobPilot AI&apos;s own plans are on our{" "}
                <Link href="/pricing" className="underline">pricing page</Link>.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {page.pricing.map((item) => (
                  <Card key={item.plan} className="gap-1 p-4" data-testid="pricing-item">
                    <p className="text-sm font-medium">{item.plan}</p>
                    <p className="font-heading text-xl font-semibold" data-testid="price">{item.price}</p>
                    {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <SourceRef number={numberFor(item.sourceUrl)} /> checked {formatCheckedDate(item.sourceDate)}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {page.differences.length > 0 && (
            <section aria-labelledby="differences-heading" data-testid="differences">
              <h2 id="differences-heading" className="mb-4 font-heading text-2xl font-semibold tracking-tight">
                Key differences
              </h2>
              <div className="flex flex-col gap-4">
                {page.differences.map((difference) => (
                  <Card key={difference.title} className="gap-3 p-5" data-testid="difference-item">
                    <h3 className="text-lg font-semibold">{difference.title}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          {name} <SourceRef number={numberFor(difference.sourceUrl)} />
                        </p>
                        <p className="text-sm">{difference.competitor}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-primary">JobPilot AI</p>
                        <p className="text-sm">{difference.jobpilot}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {page.faqs.length > 0 && (
            <section aria-labelledby="faq-heading" data-testid="faqs">
              <h2 id="faq-heading" className="mb-4 font-heading text-2xl font-semibold tracking-tight">
                Questions
              </h2>
              <Faq items={page.faqs.map((faq) => ({ question: faq.question, answer: faq.answer }))} />
            </section>
          )}

          {sources.length > 0 && (
            <section aria-labelledby="sources-heading" data-testid="sources">
              <h2 id="sources-heading" className="mb-3 font-heading text-2xl font-semibold tracking-tight">
                Sources
              </h2>
              <ol className="flex flex-col gap-2 text-sm">
                {sources.map((source) => (
                  <li key={source.url} id={`source-${source.number}`} className="scroll-mt-24" data-testid="source-item">
                    <span className="font-medium">[{source.number}]</span>{" "}
                    <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline">
                      {source.host}
                    </a>{" "}
                    <span className="text-muted-foreground">— checked {formatCheckedDate(source.checkedOn)}</span>
                    {isStale(source.checkedOn) && (
                      <span className="ml-2 inline-flex items-center gap-1 text-warning" data-testid="source-stale">
                        <AlertTriangle className="size-3.5" aria-hidden="true" /> older than {STALE_AFTER_DAYS} days
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </Section>
    </>
  );
}
