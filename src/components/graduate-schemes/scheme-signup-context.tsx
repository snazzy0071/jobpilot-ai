import { CalendarClock, ShieldCheck } from "lucide-react";
import { formatSchemeDate } from "@/components/graduate-schemes/scheme-parts";
import { applicationStatus, timelineSummary } from "@/lib/graduate-schemes/status";
import { ASSESSMENT_LABELS, GRADUATE_SCHEME_SECTOR_LABELS, GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS, type GraduateScheme } from "@/lib/graduate-schemes/types";

/**
 * The scheme someone is signing up to prepare for: employer, programme, deadline, sponsorship and required assessments, exactly
 * as recorded (a date the employer hasn't published reads "Not published"). `heading` changes the lead-in for the places it is
 * reused (signup, email-verified, onboarding).
 */
export function SchemeSignupContext({ scheme, heading = "You're signing up to prepare for" }: { scheme: GraduateScheme; heading?: string }) {
  const required = scheme.assessments.filter((assessment) => assessment.isRequired);
  const status = applicationStatus(scheme);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="scheme-signup-context">
      <p className="text-xs font-medium text-muted-foreground">{heading}</p>
      <p className="font-heading text-base font-semibold" data-testid="ctx-programme">
        {scheme.schemeName}
      </p>
      <p className="text-sm text-muted-foreground" data-testid="ctx-employer">
        {scheme.employer} · {GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}
      </p>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-1.5" data-testid="ctx-deadline">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="sr-only">Deadline</dt>
            <dd>
              {scheme.deadlineOn ? `Deadline ${formatSchemeDate(scheme.deadlineOn)}` : scheme.isRolling ? "Rolling — no deadline" : "Deadline not published"}
              <span className="block text-xs text-muted-foreground">{status === "closed" ? "Closed" : timelineSummary(scheme)}</span>
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-1.5" data-testid="ctx-sponsorship">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <dt className="sr-only">Visa sponsorship</dt>
            <dd>Visa sponsorship: {GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[scheme.sponsorshipStatus]}</dd>
          </div>
        </div>
      </dl>
      <p className="text-sm" data-testid="ctx-assessments">
        <span className="text-muted-foreground">Required assessments: </span>
        {required.length > 0 ? required.map((assessment) => assessment.label ?? ASSESSMENT_LABELS[assessment.type]).join(", ") : "none recorded"}
      </p>
    </div>
  );
}
