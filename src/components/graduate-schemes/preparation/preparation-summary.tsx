import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StartPreparationButton } from "@/components/graduate-schemes/preparation/journey-actions";
import { ASSESSMENT_LABELS, GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS, type GraduateScheme } from "@/lib/graduate-schemes/types";
import { applicationStatus, timelineSummary } from "@/lib/graduate-schemes/status";
import { ATS_READY_SCORE, JOURNEY_STEPS, JOURNEY_STEP_LABELS, testRowReady, type StepStatus } from "@/lib/graduate-schemes/preparation/progress";
import type { PreparationState } from "@/lib/graduate-schemes/preparation/queries";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/types";

export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  todo: "To do",
  not_applicable: "Not needed",
  locked: "Plan required",
};

export function StepStatusBadge({ status }: { status: StepStatus }) {
  const variant = status === "done" ? "default" : status === "in_progress" ? "secondary" : "outline";
  return (
    <Badge variant={variant} data-testid="step-status">
      {STEP_STATUS_LABELS[status]}
    </Badge>
  );
}

function Row({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5" data-testid={testId}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

/** The "Your preparation" card on a scheme page: the eight things a candidate needs at a glance, from live data. */
export function PreparationSummary({ scheme, state, prepareHref }: { scheme: GraduateScheme; state: PreparationState; prepareHref: string }) {
  const required = scheme.assessments.filter((assessment) => assessment.isRequired);
  const status = applicationStatus(scheme);
  const testsDone = state.tests.filter(testRowReady).length;
  const completedInterviews = state.interviews.filter((session) => session.status === "completed");
  const best = completedInterviews.reduce<number | null>((max, s) => (s.overallScore !== null && (max === null || s.overallScore > max) ? s.overallScore : max), null);

  return (
    <Card className="gap-4 p-5" data-testid="preparation-summary">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">Your preparation</h2>
          <p className="text-sm text-muted-foreground" data-testid="prep-percent">
            {state.started ? `${state.percent}% of the steps that apply to you are done` : "Not started yet"}
          </p>
        </div>
        {state.started ? <Button render={<Link href={prepareHref}>Continue preparing</Link>} /> : <StartPreparationButton schemeId={scheme.id} label="Prepare application" />}
      </div>

      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Row label="Deadline" testId="sum-deadline">
          {status === "closed" ? "Closed" : timelineSummary(scheme)}
        </Row>
        <Row label="Visa sponsorship" testId="sum-sponsorship">
          {GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[scheme.sponsorshipStatus]}
        </Row>
        <Row label="Required assessments" testId="sum-assessments">
          {required.length > 0 ? required.map((assessment) => assessment.label ?? ASSESSMENT_LABELS[assessment.type]).join(", ") : "None recorded"}
        </Row>
        <Row label="CV readiness" testId="sum-cv">
          {state.cv ? `${state.cv.readiness.percent}% — ${state.cv.readiness.ready ? "ready" : "needs work"} (${state.cv.title})` : "No CV chosen"}
        </Row>
        <Row label="ATS score" testId="sum-ats">
          {state.ats ? `${state.ats.score}/100 — ${state.ats.score >= ATS_READY_SCORE ? "ready" : `below ${ATS_READY_SCORE}`}` : "Not checked yet"}
        </Row>
        <Row label="Test progress" testId="sum-tests">
          {state.tests.length === 0
            ? "No practice needed for this scheme's assessments"
            : state.testsLocked
              ? "Test Prep needs Premium or Elite"
              : `${testsDone} of ${state.tests.length} test type${state.tests.length === 1 ? "" : "s"} ready`}
        </Row>
        <Row label="Interview progress" testId="sum-interview">
          {state.interviews.length === 0
            ? "No mock interview yet"
            : `${completedInterviews.length} completed of ${state.interviews.length}${best !== null ? ` · best ${best}/100` : ""}`}
        </Row>
        <Row label="Tracker status" testId="sum-tracker">
          {state.tracker ? APPLICATION_STATUS_LABELS[state.tracker.status as ApplicationStatus] ?? state.tracker.status : "Not in your tracker"}
        </Row>
      </dl>

      {state.started && (
        <ol className="flex flex-wrap gap-2" aria-label="Preparation steps">
          {JOURNEY_STEPS.map((step) => (
            <li key={step} className="flex items-center gap-1.5 text-xs" data-testid={`sum-step-${step}`} data-status={state.statuses[step]}>
              <StepStatusBadge status={state.statuses[step]} /> {JOURNEY_STEP_LABELS[step]}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
