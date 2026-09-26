import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FreshnessNote, formatSchemeDate } from "@/components/graduate-schemes/scheme-parts";
import { ASSESSMENT_PREP, PREP_COVERAGE_LABELS, type PrepLink } from "@/config/assessment-prep";
import { ASSESSMENT_LABELS, type SchemeAssessment } from "@/lib/graduate-schemes/types";

/** Where a prep link goes: Test Prep links land on that test type's own section when we know its id. */
function hrefFor(link: PrepLink, testTypeIds: Record<string, string>): string {
  const id = link.testTypeSlug ? testTypeIds[link.testTypeSlug] : undefined;
  return id ? `${link.href}#${id}` : link.href;
}

/**
 * Every assessment the scheme is mapped to, with the evidence for that claim and the JobPilot preparation that really
 * exists for it (src/config/assessment-prep.ts) — including an honest "nothing yet" where there isn't any.
 */
export function AssessmentSection({ assessments, testTypeIds }: { assessments: SchemeAssessment[]; testTypeIds: Record<string, string> }) {
  return (
    <ul className="flex flex-col gap-4" data-testid="assessments">
      {assessments.map((item) => {
        const prep = ASSESSMENT_PREP[item.type];
        const name = ASSESSMENT_LABELS[item.type];
        return (
          <li key={item.id} className="flex flex-col gap-2 rounded-lg border p-4" data-testid="assessment" data-type={item.type}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-medium" data-testid="assessment-name">
                {name}
                {item.label && <span className="font-normal text-muted-foreground"> — {item.label}</span>}
              </h3>
              <Badge variant={item.isRequired ? "default" : "outline"} data-testid="assessment-required">
                {item.isRequired ? "Required" : "May be used"}
              </Badge>
            </div>

            {item.provider && (
              <p className="text-sm" data-testid="assessment-provider">
                <span className="text-muted-foreground">Provider named by the employer:</span> {item.provider}
              </p>
            )}
            {item.notes && <p className="text-sm text-muted-foreground">{item.notes}</p>}

            <div className="rounded-md bg-muted/50 p-3 text-sm" data-testid="assessment-prep" data-coverage={prep.coverage}>
              <p className="mb-1 flex flex-wrap items-center gap-2 text-xs font-medium">
                <Badge variant={prep.coverage === "full" ? "tinted" : "outline"}>{PREP_COVERAGE_LABELS[prep.coverage]}</Badge>
              </p>
              <p>{prep.summary}</p>
              {prep.links.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {prep.links.map((link) => (
                    <li key={link.label}>
                      <Link href={hrefFor(link, testTypeIds)} className="font-medium underline" data-testid="prep-link">
                        {link.label}
                      </Link>
                      {link.note && <span className="text-xs text-muted-foreground"> · {link.note}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" data-testid="assessment-evidence">
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-foreground underline">
                Source: {new URL(item.sourceUrl).hostname.replace(/^www\./, "")} <ExternalLink className="size-3" aria-hidden="true" />
              </a>
              <span>Source dated {formatSchemeDate(item.sourceDate)}</span>
              <span>Verified {formatSchemeDate(item.verifiedAt)}</span>
              <FreshnessNote scheme={{ verifiedAt: item.verifiedAt }} />
            </p>
          </li>
        );
      })}
    </ul>
  );
}
