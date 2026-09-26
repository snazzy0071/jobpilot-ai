import Link from "next/link";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  FlameIcon,
  MessagesSquareIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TargetIcon,
  UserCircleIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardArrow, CardIcon, CardStatus } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/motion/animated-counter";
import { AnimatedBar } from "@/components/dashboard/animated-bar";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/types";
import type { ApplicationFunnelAnalytics } from "@/lib/applications/analytics";
import type { JobMatchPreview, SavedJobPreview } from "@/lib/dashboard/overview";
import { deadlineLabel, type DeadlineItem } from "@/lib/dashboard/deadlines";

// Every card below is a plain Server Component composed from the shared
// Card variants (ui/card.tsx) — the only client pieces are the tiny
// AnimatedCounter/AnimatedBar leaves, so the whole overview costs almost
// no client JS. Each one renders an honest empty state (with a real link
// to the tool that would fill it) when there's no data yet, never a
// placeholder figure.

const NUMBER = new Intl.NumberFormat("en-GB");

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function CardHeading({ icon, eyebrow, title, href, linkLabel }: { icon: LucideIcon; eyebrow: string; title: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <CardIcon icon={icon} className="size-9" />
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</p>
          <p className="font-heading text-xl font-semibold">{title}</p>
        </div>
      </div>
      {href && linkLabel && (
        <Link href={href} className="shrink-0 text-xs font-medium text-primary hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-2 rounded-lg border border-dashed p-4">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------
// Metric tile — the headline number row. A link when it has somewhere
// real to go (Card `feature` variant: lift + glow + arrow), a calm
// `metric` tile when it doesn't.
// ---------------------------------------------------------------

export function OverviewMetricCard({
  icon,
  label,
  value,
  suffix,
  empty,
  caption,
  href,
}: {
  icon: LucideIcon;
  label: string;
  /** null renders `empty` instead — a real "nothing yet", never a 0 that reads like data. */
  value: number | null;
  suffix?: string;
  empty?: string;
  caption?: string;
  href?: string;
}) {
  const body = (
    <Card data-metric={label} variant={href ? "feature" : "metric"} className="h-full gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <CardIcon icon={icon} className="size-9" />
        {href && <CardArrow className="mt-1" />}
      </div>
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        <p className="mt-1 font-heading text-4xl font-bold tracking-tight">
          {value === null ? (
            <span className="text-2xl text-muted-foreground">{empty ?? "—"}</span>
          ) : (
            <AnimatedCounter value={value} suffix={suffix} />
          )}
        </p>
      </div>
      {caption && <p className="truncate text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );

  return href ? (
    <Link href={href} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    body
  );
}

// ---------------------------------------------------------------
// Welcome + profile completion
// ---------------------------------------------------------------

export type ProfileCompletionItem = { label: string; done: boolean };

export function WelcomeCard({
  heading,
  subheading,
  planLabel,
  completion,
  nudge,
}: {
  heading: string;
  subheading: string;
  planLabel: string;
  completion: ProfileCompletionItem[];
  nudge?: { label: string; href: string };
}) {
  const done = completion.filter((item) => item.done).length;
  const pct = completion.length === 0 ? 100 : Math.round((done / completion.length) * 100);
  const missing = completion.filter((item) => !item.done);

  return (
    <Card data-testid="dashboard-welcome" variant="tool" animatedAccent className="gap-5 p-6 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <Badge variant="tinted" className="mb-2 capitalize">
          {planLabel} plan
        </Badge>
        <h1 className="font-heading text-3xl leading-tight font-bold tracking-tight sm:text-4xl">{heading}</h1>
        <p className="mt-1 text-muted-foreground">{subheading}</p>
        {nudge && (
          <Button className="mt-4" render={<Link href={nudge.href}>{nudge.label} <ArrowRightIcon /></Link>} />
        )}
      </div>

      <div className="w-full shrink-0 rounded-xl border bg-muted/30 p-4 md:w-72">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <UserCircleIcon className="size-4 text-primary" /> Profile
          </span>
          <span className="font-semibold text-primary">
            <AnimatedCounter value={pct} suffix="%" />
          </span>
        </div>
        <AnimatedBar value={pct} className="mt-2" />
        {missing.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Add {missing.slice(0, 2).map((item) => item.label.toLowerCase()).join(" and ")}
            {missing.length > 2 ? ` +${missing.length - 2} more` : ""} in{" "}
            <Link href="/dashboard/settings" className="font-medium text-primary hover:underline">
              Settings
            </Link>
            .
          </p>
        ) : (
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2Icon className="size-3.5 text-success" /> Profile complete
          </p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// Plan + usage
// ---------------------------------------------------------------

export type UsageMeter = { label: string; used: number; limit: number | null };

function meterText(meter: UsageMeter): string {
  if (meter.limit === 0) return "Not on this plan";
  if (meter.limit === null) return `${NUMBER.format(meter.used)} · unlimited`;
  return `${NUMBER.format(meter.used)} / ${NUMBER.format(meter.limit)}`;
}

function meterPct(meter: UsageMeter): number {
  if (meter.limit === null) return 100;
  if (!meter.limit) return 0;
  return (meter.used / meter.limit) * 100;
}

export function PlanUsageCard({ planLabel, meters, upgradeHref }: { planLabel: string; meters: UsageMeter[]; upgradeHref?: string }) {
  return (
    <Card data-testid="dashboard-plan" variant="tool" className="h-full gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <CardIcon icon={SparklesIcon} className="size-9" />
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Current plan</p>
            <p className="font-heading text-xl font-semibold capitalize">{planLabel}</p>
          </div>
        </div>
        {upgradeHref && <Button size="sm" variant="outline" render={<Link href={upgradeHref}>Upgrade</Link>} />}
      </div>
      <div className="flex flex-col gap-3">
        {meters.map((meter, index) => (
          <div key={meter.label} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{meter.label}</span>
              <span className="font-medium">{meterText(meter)}</span>
            </div>
            <AnimatedBar
              value={meterPct(meter)}
              delay={index * 0.08}
              className={meter.limit === null || meter.limit === 0 ? "opacity-40" : undefined}
              barClassName={meter.limit !== null && meter.limit > 0 && meter.used >= meter.limit ? "bg-warning" : undefined}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------
// Applications by stage
// ---------------------------------------------------------------

const STAGE_COLOURS: Record<ApplicationStatus, string> = {
  wishlist: "bg-muted-foreground/50",
  applied: "bg-primary",
  interview: "bg-brand-secondary",
  offer: "bg-success",
  rejected: "bg-destructive/70",
  withdrawn: "bg-muted-foreground/30",
};

export function ApplicationsByStageCard({ funnel }: { funnel: ApplicationFunnelAnalytics }) {
  return (
    <Card data-testid="dashboard-stages" variant="tool" className="h-full gap-4 p-5">
      <CardHeading
        icon={BriefcaseIcon}
        eyebrow="Your pipeline"
        title={<><AnimatedCounter value={funnel.totalApplications} /> tracked</>}
        href="/dashboard/applications"
        linkLabel="Open tracker"
      />

      {funnel.totalApplications === 0 ? (
        <EmptyState
          message="No applications tracked yet — add one to watch it move from wishlist to offer."
          action={<Button size="sm" render={<Link href="/dashboard/applications/new">Track an application</Link>} />}
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {funnel.byStage.map((stage) => (
              <div key={stage.status} className="rounded-lg border bg-muted/30 p-2 text-center">
                <p className="font-heading text-xl font-semibold">{stage.currentCount}</p>
                <p className="text-[10px] text-muted-foreground">{APPLICATION_STATUS_LABELS[stage.status]}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {funnel.byStage
              .filter((stage) => stage.currentCount > 0)
              .map((stage, index) => (
                <div key={stage.status} className="flex items-center gap-3 text-xs">
                  <span className="w-16 shrink-0 text-muted-foreground">{APPLICATION_STATUS_LABELS[stage.status]}</span>
                  <AnimatedBar
                    value={(stage.currentCount / funnel.totalApplications) * 100}
                    delay={index * 0.06}
                    barClassName={STAGE_COLOURS[stage.status]}
                  />
                </div>
              ))}
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              Interview rate <strong className="text-foreground">{funnel.interviewRate !== null ? `${funnel.interviewRate}%` : "—"}</strong>
            </span>
            <span>
              Offer rate <strong className="text-foreground">{funnel.offerRate !== null ? `${funnel.offerRate}%` : "—"}</strong>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Interviews
// ---------------------------------------------------------------

export function InterviewsCard({
  completed,
  inProgress,
  atInterviewStage,
  meters,
  openInterview,
}: {
  completed: number;
  inProgress: number;
  atInterviewStage: number;
  meters: UsageMeter[];
  openInterview: { id: string; role: string } | null;
}) {
  return (
    <Card data-testid="dashboard-interviews" variant="tool" className="h-full gap-4 p-5">
      <CardHeading
        icon={MessagesSquareIcon}
        eyebrow="Interviews"
        title={<><AnimatedCounter value={completed} /> practised</>}
        href="/dashboard/interview"
        linkLabel="Coach"
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="font-heading text-2xl font-semibold">{atInterviewStage}</p>
          <p className="text-[11px] text-muted-foreground">Real interviews in your tracker</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="font-heading text-2xl font-semibold">{inProgress}</p>
          <p className="text-[11px] text-muted-foreground">Practice session{inProgress === 1 ? "" : "s"} open</p>
        </div>
      </div>

      {meters.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {meters.map((meter) => (
            <div key={meter.label} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{meter.label} this month</span>
                <span className="font-medium">{meterText(meter)}</span>
              </div>
              <AnimatedBar value={meterPct(meter)} className={meter.limit === null || meter.limit === 0 ? "opacity-40" : undefined} />
            </div>
          ))}
        </div>
      )}

      {openInterview && (
        <Button size="sm" render={<Link href={`/dashboard/interview/${openInterview.id}`}>Resume {openInterview.role}</Link>} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Saved / matched jobs + sponsor activity
// ---------------------------------------------------------------

export function SavedJobsCard({ total, sponsored, latest }: { total: number; sponsored: number; latest: SavedJobPreview[] }) {
  return (
    <Card data-testid="dashboard-saved-jobs" variant="tool" className="h-full gap-4 p-5">
      <CardHeading
        icon={TargetIcon}
        eyebrow="Saved jobs"
        title={<><AnimatedCounter value={total} /> saved</>}
        href="/dashboard/jobs"
        linkLabel="Job feed"
      />

      {latest.length === 0 ? (
        <EmptyState
          message="Save roles from the job feed to see your best matches here."
          action={<Button size="sm" variant="outline" render={<Link href="/dashboard/jobs">Browse jobs</Link>} />}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {latest.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{job.jobTitle}</p>
                  <p className="truncate text-xs text-muted-foreground">{job.companyName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {job.matchScore !== null && <span className="text-sm font-semibold text-primary">{job.matchScore}%</span>}
                  {job.sponsorStatus === "confirmed_sponsor" && <CardStatus className="text-success">Sponsor</CardStatus>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {sponsored} of your {total} saved role{total === 1 ? "" : "s"} {sponsored === 1 ? "is" : "are"} at a licensed sponsor.
          </p>
        </>
      )}
    </Card>
  );
}

const SPONSOR_LABELS: Record<string, string> = {
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
  not_found: "Not on register",
  not_checked: "Not checked",
};

export function SponsorActivityCard({ funnel }: { funnel: ApplicationFunnelAnalytics }) {
  const active = funnel.sponsorSplit.filter((entry) => entry.count > 0);
  const confirmed = funnel.sponsorSplit.find((entry) => entry.status === "confirmed_sponsor")?.count ?? 0;
  return (
    <Card data-testid="dashboard-sponsor" variant="tool" className="h-full gap-4 p-5">
      <CardHeading
        icon={ShieldCheckIcon}
        eyebrow="Sponsor activity"
        title={<><AnimatedCounter value={confirmed} /> at sponsors</>}
        href="/visa-sponsors"
        linkLabel="Register"
      />
      {active.length === 0 ? (
        <EmptyState
          message="Track applications to see how many are at employers who can sponsor you."
          action={<Button size="sm" variant="outline" render={<Link href="/sponsor-licence-check">Check an employer</Link>} />}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {active.map((entry, index) => (
            <div key={entry.status} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{SPONSOR_LABELS[entry.status]}</span>
                <span className="font-medium">
                  {entry.count} · {entry.percentage}%
                </span>
              </div>
              <AnimatedBar value={entry.percentage} delay={index * 0.08} barClassName={entry.status === "confirmed_sponsor" ? "bg-success" : undefined} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Test prep accuracy (the streak strip is the existing client
// DailyPracticeCard, which needs the browser's own timezone)
// ---------------------------------------------------------------

export function TestPrepInsightCard({
  sessionCount,
  overallAccuracy,
  answerCount,
  bestAccuracy,
  weakArea,
}: {
  sessionCount: number;
  overallAccuracy: number | null;
  answerCount: number;
  bestAccuracy: number | null;
  weakArea: string | null;
}) {
  return (
    <Card data-testid="dashboard-testprep" variant="tool" className="h-full gap-4 p-5">
      <CardHeading
        icon={FlameIcon}
        eyebrow="Test prep"
        title={<><AnimatedCounter value={sessionCount} /> session{sessionCount === 1 ? "" : "s"}</>}
        href="/dashboard/test-prep/progress"
        linkLabel="Progress"
      />
      {sessionCount === 0 ? (
        <EmptyState
          message="Finish a practice session to see your accuracy and weak spots."
          action={<Button size="sm" variant="outline" render={<Link href="/dashboard/test-prep">Start practising</Link>} />}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-heading text-2xl font-semibold">
                {overallAccuracy !== null ? <AnimatedCounter value={overallAccuracy} suffix="%" /> : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">Overall accuracy · {answerCount} answer{answerCount === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="font-heading text-2xl font-semibold">
                {bestAccuracy !== null ? <AnimatedCounter value={bestAccuracy} suffix="%" /> : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground">Best session</p>
            </div>
          </div>
          {weakArea && (
            <p className="text-xs text-muted-foreground">
              Weakest area right now: <strong className="text-foreground">{weakArea}</strong>
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Recommended next actions
// ---------------------------------------------------------------

export type NextAction = { icon: LucideIcon; title: string; description: string; href: string };

export function NextActionsCard({ actions }: { actions: NextAction[] }) {
  return (
    <Card data-testid="dashboard-next-actions" variant="action" className="h-full gap-3 p-5">
      <CardHeading icon={SparklesIcon} eyebrow="Recommended next" title="What to do today" />
      {actions.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-4 text-success" /> You&apos;re all caught up — nothing needs your attention right now.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {actions.map((action) => (
            <li key={action.title}>
              <Link
                href={action.href}
                className="group/action flex items-center gap-3 rounded-lg border bg-card/60 p-3 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <action.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{action.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
                </span>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-hover/action:translate-x-1 group-hover/action:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Recent activity
// ---------------------------------------------------------------

export type ActivityEntry = { id: string; icon: LucideIcon; title: string; detail: string; at: string; href: string };

export function RecentActivityCard({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Card data-testid="dashboard-activity" variant="admin" className="gap-0 p-0">
      <div className="flex items-center gap-2.5 border-b p-5">
        <CardIcon icon={CalendarClockIcon} className="size-9" />
        <p className="font-heading text-xl font-semibold">Recent activity</p>
      </div>
      {entries.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Nothing yet — build a CV, run a scan or track an application and it shows up here.</p>
      ) : (
        <ul className="divide-y">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                href={entry.href}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <entry.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{entry.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{entry.detail}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Job matches — jobs this user has already had scored against a CV
// (nothing is scored on the dashboard itself, and nothing is invented).
// ---------------------------------------------------------------

export function JobMatchesCard({ scored, strong, top, strongThreshold }: { scored: number; strong: number; top: JobMatchPreview[]; strongThreshold: number }) {
  return (
    <Card variant="tool" className="h-full gap-4 p-5" data-testid="dashboard-job-matches">
      <CardHeading
        icon={TargetIcon}
        eyebrow="Job matches"
        title={<><AnimatedCounter value={scored} /> scored</>}
        href="/dashboard/jobs"
        linkLabel="Job feed"
      />
      {top.length === 0 ? (
        <EmptyState
          message="Open a job in the feed and score it against your CV to see how well you match."
          action={<Button size="sm" variant="outline" render={<Link href="/dashboard/jobs">Find jobs</Link>} />}
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {top.map((match) => (
              <Link key={match.jobId} href="/dashboard/jobs" className="flex items-center justify-between gap-3 rounded-lg border p-2.5 hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{match.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{match.company}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-primary">{match.score}%</span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {strong} of your {scored} scored job{scored === 1 ? "" : "s"} {strong === 1 ? "is" : "are"} a strong match ({strongThreshold}%+). Active listings only.
          </p>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------
// Deadlines — dates that were actually recorded: the user's own
// not-yet-applied tracker entries and published scheme closing dates.
// ---------------------------------------------------------------

export function DeadlinesCard({ items }: { items: DeadlineItem[] }) {
  return (
    <Card variant="tool" className="h-full gap-4 p-5" data-testid="dashboard-deadlines">
      <CardHeading
        icon={CalendarClockIcon}
        eyebrow="Deadlines"
        title={items.length === 0 ? "None in 30 days" : <><AnimatedCounter value={items.length} /> coming up</>}
        href="/deadlines"
        linkLabel="All deadlines"
      />
      {items.length === 0 ? (
        <EmptyState
          message="Add a deadline to a tracked application, or browse graduate schemes with published closing dates."
          action={<Button size="sm" variant="outline" render={<Link href="/graduate-schemes">Graduate schemes</Link>} />}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 hover:bg-muted/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.subtitle} · {new Date(`${item.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold ${item.daysLeft <= 3 ? "text-destructive" : "text-primary"}`}>{deadlineLabel(item.daysLeft)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
