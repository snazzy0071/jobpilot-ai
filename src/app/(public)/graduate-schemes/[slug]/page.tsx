import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { CtaSection } from "@/components/marketing/cta-section";
import { ApplicationStatusBadge, FreshnessNote, SchemeCard, SponsorshipBadge, formatSchemeDate } from "@/components/graduate-schemes/scheme-parts";
import { PreparationPanel } from "@/components/graduate-schemes/preparation/preparation-panel";
import { AssessmentSection } from "@/components/graduate-schemes/assessment-section";
import { getGraduateSchemes, getPublishedSchemeBySlug } from "@/lib/graduate-schemes/queries";
import { listActiveTestTypes } from "@/lib/test-prep/queries";
import { applicationStatus, timelineSummary } from "@/lib/graduate-schemes/status";
import {
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  STUDY_STAGE_LABELS,
  type GraduateScheme,
} from "@/lib/graduate-schemes/types";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

/** A meta description made only of fields the row actually has — nothing padded in. */
function describe(scheme: GraduateScheme): string {
  if (scheme.description) return scheme.description.length > 155 ? `${scheme.description.slice(0, 152).trimEnd()}…` : scheme.description;
  const parts = [`${scheme.schemeName} at ${scheme.employer} (${GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}).`, timelineSummary(scheme) + "."];
  parts.push(`Visa sponsorship: ${GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[scheme.sponsorshipStatus].toLowerCase()}.`);
  return parts.join(" ");
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scheme = await getPublishedSchemeBySlug(slug);
  if (!scheme) {
    return buildMetadata({ title: "Graduate scheme not found", description: "This graduate scheme couldn't be found.", path: `/graduate-schemes/${slug}`, noIndex: true });
  }
  return buildMetadata({ title: `${scheme.schemeName} — ${scheme.employer}`, description: describe(scheme), path: `/graduate-schemes/${scheme.slug}` });
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function GraduateSchemePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const scheme = await getPublishedSchemeBySlug(slug);
  if (!scheme) notFound();

  const status = applicationStatus(scheme);
  const related = (await getGraduateSchemes())
    .filter((other) => other.id !== scheme.id && other.sector === scheme.sector)
    .sort((a, b) => Number(applicationStatus(a) === "closed") - Number(applicationStatus(b) === "closed") || a.employer.localeCompare(b.employer))
    .slice(0, 3);
  // Test Prep sections are addressed by id, so link straight to the right one when the catalogue has it.
  const testTypeIds = Object.fromEntries((await listActiveTestTypes()).map((type) => [type.slug, type.id]));

  const pageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${scheme.schemeName} — ${scheme.employer}`,
    url: `${siteConfig.domain}/graduate-schemes/${scheme.slug}`,
    description: describe(scheme),
    dateModified: scheme.updatedAt,
    about: { "@type": "Organization", name: scheme.employer },
  };

  return (
    <>
      <Section className="pb-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Graduate schemes", href: "/graduate-schemes" }, { label: scheme.schemeName }]} />
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {scheme.employer} · {GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{scheme.schemeName}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <ApplicationStatusBadge scheme={scheme} />
              <SponsorshipBadge status={scheme.sponsorshipStatus} />
            </div>
            <p className="text-sm" data-testid="timeline">
              {timelineSummary(scheme)}
            </p>
            {scheme.applicationUrl && status !== "closed" && (
              <div>
                <Button
                  size="lg"
                  render={
                    <a href={scheme.applicationUrl} target="_blank" rel="noopener noreferrer nofollow" data-testid="apply-link">
                      Apply on the employer&apos;s site <ExternalLink aria-hidden="true" />
                    </a>
                  }
                />
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section className="pt-0 pb-6">
        <div className="mx-auto max-w-4xl">
          <PreparationPanel scheme={scheme} />
        </div>
      </Section>

      <Section tone="muted" className="py-10">
        <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            {scheme.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About the programme</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-relaxed whitespace-pre-line" data-testid="description">
                  {scheme.description}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>At a glance</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Fact label="Employer">{scheme.employer}</Fact>
                  <Fact label="Programme">{scheme.schemeName}</Fact>
                  <Fact label="Sector">{GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}</Fact>
                  <Fact label="Salary">{scheme.salary ?? "Not published by the employer"}</Fact>
                  <Fact label="Open to">
                    {scheme.studyStages.length > 0 ? (
                      <ul className="list-disc pl-4">
                        {scheme.studyStages.map((stage) => (
                          <li key={stage}>{STUDY_STAGE_LABELS[stage]}</li>
                        ))}
                      </ul>
                    ) : (
                      "Not published by the employer"
                    )}
                  </Fact>
                  <Fact label="Locations">
                    {scheme.locations.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {scheme.locations.map((location) => (
                          <Badge key={location} variant="outline">
                            <MapPin aria-hidden="true" /> {location}
                          </Badge>
                        ))}
                      </span>
                    ) : (
                      "Not published by the employer"
                    )}
                  </Fact>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Key dates</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-3" data-testid="dates">
                  <Fact label="Applications open">{scheme.opensOn ? formatSchemeDate(scheme.opensOn) : "Not published"}</Fact>
                  <Fact label="Deadline">{scheme.deadlineOn ? formatSchemeDate(scheme.deadlineOn) : scheme.isRolling ? "None — rolling" : "Not published"}</Fact>
                  <Fact label="Rolling applications">{scheme.isRolling ? "Yes — reviewed as they arrive, so it can fill before any deadline" : "No"}</Fact>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How you are assessed</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {scheme.assessments.length > 0 ? (
                  <AssessmentSection assessments={scheme.assessments} testTypeIds={testTypeIds} />
                ) : (
                  <p className="text-muted-foreground" data-testid="no-assessments">
                    No assessments have been recorded for this scheme yet — we only list ones the employer&apos;s own information confirms.
                  </p>
                )}
                {scheme.assessmentNotes && <p className="text-muted-foreground">{scheme.assessmentNotes}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visa sponsorship</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p>
                  <SponsorshipBadge status={scheme.sponsorshipStatus} />
                </p>
                {scheme.notes && <p className="text-muted-foreground">{scheme.notes}</p>}
                <p className="text-muted-foreground">
                  This describes the employer&apos;s position, not a guarantee of a visa. Check the employer on the{" "}
                  <Link href={`/visa-sponsors?q=${encodeURIComponent(scheme.employer)}`} className="underline">
                    sponsor register
                  </Link>
                  . Not immigration advice.
                </p>
              </CardContent>
            </Card>
          </div>

          <aside className="flex flex-col gap-4" aria-label="Source and verification">
            <Card>
              <CardHeader>
                <CardTitle>Source</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm" data-testid="source">
                <a href={scheme.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium underline break-all">
                  {new URL(scheme.sourceUrl).hostname.replace(/^www\./, "")} <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                </a>
                <p className="text-muted-foreground">Source dated {formatSchemeDate(scheme.sourceDate)}</p>
                <p className="text-muted-foreground">Last verified {formatSchemeDate(scheme.verifiedAt)}</p>
                <FreshnessNote scheme={scheme} />
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">Details can change. Always confirm dates and requirements on the employer&apos;s own page before you apply.</p>
          </aside>
        </div>
      </Section>

      {related.length > 0 && (
        <Section className="py-10">
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            <h2 className="font-heading text-xl font-semibold">More in {GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}</h2>
            <div className="flex flex-col gap-3">
              {related.map((other) => (
                <SchemeCard key={other.id} scheme={other} />
              ))}
            </div>
          </div>
        </Section>
      )}

      <CtaSection title="Get ready to apply" description="Tailor your CV to the role, check it against ATS, and practise the tests.">
        <Button size="lg" variant="secondary" render={<Link href="/signup">Create a free account</Link>} />
      </CtaSection>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
