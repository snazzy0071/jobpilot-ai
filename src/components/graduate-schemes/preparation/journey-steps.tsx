import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AtsRunner, CvPicker, InterviewStarter, StartPreparationButton, TrackerAdder } from "@/components/graduate-schemes/preparation/journey-actions";
import { StepStatusBadge } from "@/components/graduate-schemes/preparation/preparation-summary";
import { ASSESSMENT_PREP } from "@/config/assessment-prep";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/types";
import { formatSchemeDate, SponsorshipBadge } from "@/components/graduate-schemes/scheme-parts";
import { applicationStatus, timelineSummary } from "@/lib/graduate-schemes/status";
import { buildSchemeBrief } from "@/lib/graduate-schemes/preparation/brief";
import {
  ATS_READY_SCORE,
  CV_READY_PERCENT,
  JOURNEY_STEPS,
  JOURNEY_STEP_LABELS,
  TEST_READY_ACCURACY,
  TEST_READY_ANSWERS,
  testRowReady,
  type JourneyStep,
} from "@/lib/graduate-schemes/preparation/progress";
import type { PreparationState } from "@/lib/graduate-schemes/preparation/queries";
import { ASSESSMENT_LABELS, type GraduateScheme } from "@/lib/graduate-schemes/types";

function StepCard({ step, index, state, title, children }: { step: JourneyStep; index: number; state: PreparationState; title: string; children: React.ReactNode }) {
  const status = state.statuses[step];
  const isNext = state.next === step;
  return (
    <Card id={`step-${step}`} className={`scroll-mt-24 gap-3 p-6 ${isNext ? "ring-2 ring-primary/40" : ""}`} data-testid={`step-${step}`} data-status={status} data-next={isNext}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-sm text-primary" aria-hidden="true">
            {index + 1}
          </span>
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {isNext && <Badge variant="tinted">Next step</Badge>}
          <StepStatusBadge status={status} />
        </div>
      </div>
      {children}
    </Card>
  );
}

function Locked({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-muted-foreground" data-testid="step-blocked">
      {children}
    </p>
  );
}

export function JourneyStepper({ state }: { state: PreparationState }) {
  return (
    <nav aria-label="Preparation steps" className="flex flex-wrap gap-2" data-testid="stepper">
      {JOURNEY_STEPS.map((step, index) => {
        const status = state.statuses[step];
        return (
          <a key={step} href={`#step-${step}`} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" data-status={status} aria-current={state.next === step ? "step" : undefined}>
            {status === "done" ? <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> : <Circle className="size-4 text-muted-foreground" aria-hidden="true" />}
            {index + 1}. {JOURNEY_STEP_LABELS[step]}
            <span className="sr-only"> — {status.replace("_", " ")}</span>
          </a>
        );
      })}
    </nav>
  );
}

export function JourneySteps({ scheme, state }: { scheme: GraduateScheme; state: PreparationState }) {
  const status = applicationStatus(scheme);
  const required = scheme.assessments.filter((assessment) => assessment.isRequired);
  const unpracticable = scheme.assessments.filter((assessment) => !ASSESSMENT_PREP[assessment.type].links.some((link) => link.testTypeSlug));
  const ready = state.started;
  const openInterview = state.interviews.find((session) => session.status === "in_progress");

  return (
    <div className="flex flex-col gap-5">
      {/* 1 — scheme */}
      <StepCard step="scheme" index={0} state={state} title="The scheme">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Deadline</dt>
            <dd data-testid="deadline">
              {scheme.deadlineOn ? formatSchemeDate(scheme.deadlineOn) : scheme.isRolling ? "None — rolling" : "Not published"}
              <span className="block text-muted-foreground">{status === "closed" ? "Closed" : timelineSummary(scheme)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Visa sponsorship</dt>
            <dd>
              <SponsorshipBadge status={scheme.sponsorshipStatus} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Required assessments</dt>
            <dd data-testid="required-assessments">{required.length > 0 ? required.map((a) => a.label ?? ASSESSMENT_LABELS[a.type]).join(", ") : "None recorded"}</dd>
          </div>
        </dl>
        {status === "closed" && <p className="text-sm text-destructive">This scheme has closed. You can still practise, but check the employer&apos;s page before relying on it.</p>}
        {ready ? (
          <p className="text-sm text-muted-foreground">Started {state.startedAt ? formatSchemeDate(state.startedAt.slice(0, 10)) : ""}. Your progress on every step is saved for this scheme.</p>
        ) : (
          <StartPreparationButton schemeId={scheme.id} label="Start preparing" />
        )}
      </StepCard>

      {/* 2 — CV */}
      <StepCard step="cv" index={1} state={state} title="Get your CV ready">
        {!ready ? (
          <Locked>Start preparing first.</Locked>
        ) : state.cvOptions.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">You don&apos;t have a CV yet.</p>
            <Button className="w-fit" render={<Link href="/dashboard/cvs">Create a CV</Link>} />
          </div>
        ) : (
          <>
            <CvPicker schemeId={scheme.id} cvs={state.cvOptions} currentId={state.cv?.id ?? null} />
            {state.cv && (
              <div className="flex flex-col gap-2" data-testid="cv-readiness">
                <p className="text-sm font-medium">
                  <span data-testid="cv-percent">{state.cv.readiness.percent}%</span> essentials in place — {state.cv.readiness.ready ? "ready" : `aim for ${CV_READY_PERCENT}% and no open warnings`}
                </p>
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {state.cv.readiness.checks.map((check) => (
                    <li key={check.key} className="flex items-center gap-1.5" data-ok={check.ok}>
                      {check.ok ? <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> : <Circle className="size-4 text-muted-foreground" aria-hidden="true" />}
                      {check.label}
                      <span className="sr-only">{check.ok ? " — done" : " — missing"}</span>
                    </li>
                  ))}
                </ul>
                {state.cv.readiness.issues.filter((issue) => issue.severity === "warning").length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-muted-foreground" data-testid="cv-issues">
                    {state.cv.readiness.issues
                      .filter((issue) => issue.severity === "warning")
                      .slice(0, 4)
                      .map((issue) => (
                        <li key={issue.id}>{issue.message}</li>
                      ))}
                  </ul>
                )}
                <Button variant="outline" className="w-fit" render={<Link href={`/dashboard/cvs/${state.cv.id}`}>Edit this CV</Link>} />
              </div>
            )}
          </>
        )}
      </StepCard>

      {/* 3 — ATS */}
      <StepCard step="ats" index={2} state={state} title="Check it against the ATS">
        {!state.cv ? (
          <Locked>Choose a CV first.</Locked>
        ) : (
          <>
            {state.ats && (
              <div className="flex flex-col gap-1 text-sm" data-testid="ats-result">
                <p className="font-medium">
                  Latest score: <span data-testid="ats-score">{state.ats.score}</span>/100 — {state.ats.score >= ATS_READY_SCORE ? "ready" : `below the ${ATS_READY_SCORE} we aim for`}
                </p>
                <p className="text-muted-foreground">Keyword match {state.ats.keywordScore}/100 · checked {formatSchemeDate(state.ats.createdAt.slice(0, 10))}</p>
                {state.ats.missingKeywords.length > 0 && <p className="text-muted-foreground">Missing keywords: {state.ats.missingKeywords.join(", ")}</p>}
                {state.ats.score < ATS_READY_SCORE && <Button variant="outline" className="w-fit" render={<Link href={`/dashboard/cvs/${state.cv.id}`}>Improve the CV</Link>} />}
              </div>
            )}
            <AtsRunner schemeId={scheme.id} defaultText={buildSchemeBrief(scheme)} hasScan={Boolean(state.ats)} />
          </>
        )}
      </StepCard>

      {/* 4 — tests */}
      <StepCard step="tests" index={3} state={state} title="Practise the tests">
        {state.tests.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="tests-none">
            This scheme has no recorded assessment that JobPilot has aptitude practice for, so there is nothing to do here.
          </p>
        ) : state.testsLocked ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground" data-testid="tests-locked">
              This scheme uses {state.tests.map((t) => t.name.toLowerCase()).join(", ")}. Test Prep is part of the Premium and Elite plans.
            </p>
            <Button className="w-fit" render={<Link href="/pricing">See plans</Link>} />
          </div>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="test-rows">
            {state.tests.map((row) => (
              <li key={row.testTypeSlug} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3" data-testid="test-row" data-ready={testRowReady(row)}>
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm text-muted-foreground" data-testid="test-stats">
                    {row.answers === 0 ? "Not practised yet" : `${row.answers} question${row.answers === 1 ? "" : "s"} answered · ${row.accuracy}% correct`}
                    {" · "}
                    {testRowReady(row) ? "ready" : `ready at ${TEST_READY_ANSWERS}+ answers and ${TEST_READY_ACCURACY}%`}
                  </p>
                </div>
                <Button size="sm" variant={testRowReady(row) ? "outline" : "default"} render={<Link href="/dashboard/test-prep">Practise</Link>} />
              </li>
            ))}
          </ul>
        )}
        {unpracticable.length > 0 && (
          <p className="text-sm text-muted-foreground" data-testid="tests-uncovered">
            Also assessed, with no JobPilot practice yet: {unpracticable.map((a) => a.label ?? ASSESSMENT_LABELS[a.type]).join(", ")}.
          </p>
        )}
      </StepCard>

      {/* 5 — interview */}
      <StepCard step="interview" index={4} state={state} title="Rehearse the interview">
        {!state.cv ? (
          <Locked>Choose a CV first.</Locked>
        ) : (
          <>
            <InterviewStarter schemeId={scheme.id} resumeLabel={openInterview ? "Resume your mock interview" : null} />
            {state.interviews.length > 0 && (
              <ul className="flex flex-col gap-2" data-testid="interview-list">
                {state.interviews.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-testid="interview-item">
                    <span>
                      {session.mode === "voice" ? "Voice" : "Chat"} interview · {formatSchemeDate(session.createdAt.slice(0, 10))}
                    </span>
                    <span className="flex items-center gap-3">
                      <Badge variant={session.status === "completed" ? "default" : "outline"}>{session.status === "completed" ? "Completed" : session.status === "in_progress" ? "In progress" : "Abandoned"}</Badge>
                      {session.overallScore !== null && <span>{session.overallScore}/100</span>}
                      <Link href={`/dashboard/interview/${session.id}`} className="underline">
                        Open
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </StepCard>

      {/* 6 — tracker */}
      <StepCard step="tracker" index={5} state={state} title="Track the application">
        {state.tracker ? (
          <div className="flex flex-col gap-2 text-sm" data-testid="tracker-result">
            <p>
              In your tracker as <strong data-testid="tracker-status">{APPLICATION_STATUS_LABELS[state.tracker.status as ApplicationStatus] ?? state.tracker.status}</strong>
              {state.tracker.deadline ? ` · deadline ${formatSchemeDate(state.tracker.deadline)}` : ""}.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" render={<Link href={`/dashboard/applications/${state.tracker.applicationId}/edit`}>Open in tracker</Link>} />
              {scheme.applicationUrl && status !== "closed" && (
                <Button variant="outline" render={<a href={scheme.applicationUrl} target="_blank" rel="noopener noreferrer nofollow">Apply on the employer&apos;s site <ExternalLink aria-hidden="true" /></a>} />
              )}
            </div>
          </div>
        ) : !ready ? (
          <Locked>Start preparing first.</Locked>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Adds the scheme to your tracker as Wishlist, with its deadline, location, salary and link, so reminders and status live in one place.</p>
            <TrackerAdder schemeId={scheme.id} />
          </>
        )}
      </StepCard>
    </div>
  );
}
