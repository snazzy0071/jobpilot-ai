import {
  BriefcaseIcon,
  FileTextIcon,
  IdCardIcon,
  MessagesSquareIcon,
  ScanSearchIcon,
  TargetIcon,
  UserCircleIcon,
  FlameIcon,
  MailIcon,
} from "lucide-react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getAllToolAccessStates } from "@/lib/entitlements/tool-access";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import { listCvs } from "@/lib/cvs/queries";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { listInterviewSessions } from "@/lib/interviews/queries";
import { listLinkedinDrafts } from "@/lib/linkedin/queries";
import { ToolAccessCard, type ToolStat } from "@/components/entitlements/tool-access-card";
import { GettingStartedChecklist, type ChecklistItem } from "@/components/dashboard/getting-started-checklist";
import { ContinueEditingCard } from "@/components/dashboard/continue-editing-card";
import { DailyAtsActionCard } from "@/components/dashboard/daily-ats-action-card";
import { DailyPracticeCard } from "@/components/test-prep/daily-practice-card";
import {
  ApplicationsByStageCard,
  InterviewsCard,
  NextActionsCard,
  OverviewMetricCard,
  PlanUsageCard,
  RecentActivityCard,
  SavedJobsCard,
  SponsorActivityCard,
  TestPrepInsightCard,
  WelcomeCard,
  type ActivityEntry,
  type NextAction,
  type UsageMeter,
} from "@/components/dashboard/overview-cards";
import { StaggerContainer } from "@/components/motion/stagger-container";
import { StaggerItem } from "@/components/motion/stagger-item";
import { PLAN_LABELS, type PlanTier } from "@/config/plans";
import { TOOLS } from "@/config/tools";

export const dynamic = "force-dynamic";

function daysAgoLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  // requireOnboardedUser (not requireUser): returns the *effective*
  // identity, so an admin's "View as user" session shows the target's
  // dashboard rather than the admin's own.
  const { user, profile } = await requireOnboardedUser();
  const [accessStates, cvs, coverLetters, interviewSessions, linkedinDrafts, overview] = await Promise.all([
    getAllToolAccessStates(user.id),
    listCvs(user.id),
    listCoverLetters(user.id),
    listInterviewSessions(user.id),
    listLinkedinDrafts(user.id),
    getDashboardOverview(user.id),
  ]);

  const { funnel, applications, savedJobs, preferences, testPrep, planSlug } = overview;

  const accessByToolSlug = new Map(accessStates.map((state) => [state.toolSlug, state]));
  const activeCvs = cvs.filter((cv) => !cv.isArchived);
  const mostRecentCv = activeCvs[0] ?? null; // listCvs already orders by updated_at desc.
  const latestScoredCv = activeCvs.find((cv) => cv.atsScore !== null) ?? null;
  const completedInterviews = interviewSessions.filter((session) => session.status === "completed");
  const openInterview = interviewSessions.find((session) => session.status === "in_progress") ?? null;
  const inProgressCount = interviewSessions.filter((session) => session.status === "in_progress").length;
  const hasAtsScan = latestScoredCv !== null;
  const atInterviewStage = funnel.byStage.find((stage) => stage.status === "interview")?.currentCount ?? 0;
  const appliedCount = funnel.byStage.find((stage) => stage.status === "applied")?.currentCount ?? 0;

  // ---- plan + usage: read straight off the same real entitlement
  // checks the tool cards already use (used/limit per metered key),
  // never a number invented for display.
  const checkFor = (slug: string, label: string) =>
    accessByToolSlug.get(slug)?.checks.find((check) => check.label === label);
  const toMeter = (label: string, check: ReturnType<typeof checkFor>, usedOverride?: number): UsageMeter | null =>
    check && check.limit !== undefined ? { label, used: usedOverride ?? check.used ?? 0, limit: check.limit } : null;

  const cvMeter = toMeter("CVs", checkFor("cv", "CVs"), activeCvs.length);
  const quickAts = toMeter("Quick ATS scans", checkFor("ats", "Quick ATS scans"));
  const tailoredAts = toMeter("Tailored ATS scans", checkFor("ats", "Tailored ATS scans"));
  const chatInterviews = toMeter("Chat interviews", checkFor("interview", "Chat interviews"));
  const voiceInterviews = toMeter("Voice interviews", checkFor("interview", "Voice interviews"));

  const planMeters = [cvMeter, quickAts, tailoredAts, chatInterviews, voiceInterviews].filter((meter): meter is UsageMeter => meter !== null);
  const interviewMeters = [chatInterviews, voiceInterviews].filter((meter): meter is UsageMeter => meter !== null);
  const planLabel = PLAN_LABELS[planSlug as PlanTier] ?? planSlug;

  // ---- profile completion: real fields only.
  const completion = [
    { label: "Full name", done: Boolean(profile?.full_name) },
    { label: "Date of birth", done: Boolean((profile as { date_of_birth?: string | null } | null)?.date_of_birth) },
    { label: "Target roles", done: preferences.targetRoles.length > 0 },
    { label: "Career stage", done: Boolean(preferences.careerStage) },
    { label: "Location", done: Boolean(preferences.location) },
    { label: "Graduation year", done: preferences.graduationYear !== null },
    { label: "Sponsorship preference", done: preferences.visaSponsorshipPreference !== null },
  ];

  // ---- per-tool stat on the tool grid (unchanged behaviour).
  const statsBySlug: Partial<Record<string, ToolStat>> = {
    cv: { value: String(activeCvs.length), unit: activeCvs.length === 1 ? "CV" : "CVs" },
    "cover-letter": { value: String(coverLetters.length), unit: coverLetters.length === 1 ? "letter" : "letters" },
    ...(completedInterviews.length > 0 && { interview: { value: String(completedInterviews.length), unit: "done" } }),
    ...(latestScoredCv?.atsScore != null && { ats: { value: String(latestScoredCv.atsScore), unit: "/100" } }),
    ...(linkedinDrafts.length > 0 && { linkedin: { value: String(linkedinDrafts.length), unit: linkedinDrafts.length === 1 ? "draft" : "drafts" } }),
  };

  // ---- getting started: every step is a real fact about this account.
  const checklist: ChecklistItem[] = [
    { label: "Build your CV", done: activeCvs.length > 0 },
    { label: "Run your first ATS scan", done: hasAtsScan },
    { label: "Save a job", done: savedJobs.total > 0 },
    { label: "Track an application", done: funnel.totalApplications > 0 },
    { label: "Practise an interview", done: completedInterviews.length > 0 },
    { label: "Optimise your LinkedIn profile", done: linkedinDrafts.length > 0 },
  ];

  // ---- recommended next actions: rule-based off the real state above,
  // most valuable first, capped so the card stays a short list.
  const weakRecommendation = testPrep.recommendations.find((rec) => rec.kind === "weak_subtype");
  const nextActions: NextAction[] = [];
  if (openInterview) nextActions.push({ icon: MessagesSquareIcon, title: `Finish your ${openInterview.role} interview`, description: "Pick up the practice session you left open.", href: `/dashboard/interview/${openInterview.id}` });
  if (activeCvs.length === 0) nextActions.push({ icon: FileTextIcon, title: "Build your first CV", description: "A UK-standard template, ready in minutes.", href: "/dashboard/cvs" });
  if (activeCvs.length > 0 && !hasAtsScan) nextActions.push({ icon: ScanSearchIcon, title: "Run an ATS scan on your CV", description: "See what a recruiter's filter would catch.", href: "/dashboard/ats-scanner" });
  if (completion.some((item) => !item.done)) nextActions.push({ icon: UserCircleIcon, title: "Complete your profile", description: "Better preferences mean better job matches.", href: "/dashboard/settings" });
  if (savedJobs.total === 0) nextActions.push({ icon: TargetIcon, title: "Save your first roles", description: "Browse live UK listings scored against your CV.", href: "/dashboard/jobs" });
  if (funnel.totalApplications === 0) nextActions.push({ icon: BriefcaseIcon, title: "Track an application", description: "Follow it from wishlist to offer.", href: "/dashboard/applications/new" });
  if (weakRecommendation && weakRecommendation.kind === "weak_subtype") nextActions.push({ icon: FlameIcon, title: `Drill ${weakRecommendation.subtype}`, description: `${weakRecommendation.accuracy}% accuracy so far — your weakest area.`, href: "/dashboard/test-prep" });
  if (completedInterviews.length === 0 && !openInterview) nextActions.push({ icon: MessagesSquareIcon, title: "Practise an interview", description: "Competency-style questions with STAR feedback.", href: "/dashboard/interview/new" });
  if (linkedinDrafts.length === 0) nextActions.push({ icon: IdCardIcon, title: "Optimise your LinkedIn", description: "Recruiter-friendly headline and About section.", href: "/dashboard/linkedin/new" });
  const topActions = nextActions.slice(0, 4);

  // ---- recent activity: merged from the real rows each tool already
  // stores, newest first.
  const activity: ActivityEntry[] = [
    ...activeCvs.map((cv) => ({ id: `cv-${cv.id}`, icon: FileTextIcon, title: `Edited ${cv.title}`, detail: cv.atsScore !== null ? `ATS score ${cv.atsScore}/100` : "CV", at: cv.updatedAt, href: `/dashboard/cvs/${cv.id}` })),
    ...coverLetters.map((letter) => ({ id: `cl-${letter.id}`, icon: MailIcon, title: `Cover letter · ${letter.companyName}`, detail: letter.jobTitle, at: letter.updatedAt, href: `/dashboard/cover-letters/${letter.id}` })),
    ...interviewSessions.map((session) => ({ id: `iv-${session.id}`, icon: MessagesSquareIcon, title: `${session.status === "completed" ? "Completed" : "Started"} interview · ${session.role}`, detail: session.company ?? "Practice session", at: session.createdAt, href: `/dashboard/interview/${session.id}` })),
    ...applications.map((application) => ({ id: `app-${application.id}`, icon: BriefcaseIcon, title: `${application.jobTitle} · ${application.companyName}`, detail: `Application · ${application.status}`, at: application.updatedAt, href: `/dashboard/applications/${application.id}/edit` })),
    ...savedJobs.latest.map((job) => ({ id: `sj-${job.id}`, icon: TargetIcon, title: `Saved ${job.jobTitle}`, detail: job.companyName, at: job.createdAt, href: "/dashboard/jobs" })),
    ...linkedinDrafts.map((draft) => ({ id: `li-${draft.id}`, icon: IdCardIcon, title: draft.title, detail: `LinkedIn · ${draft.targetRole}`, at: draft.updatedAt, href: `/dashboard/linkedin/${draft.id}` })),
  ]
    .filter((entry) => Boolean(entry.at))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 7);

  // ---- test prep accuracy
  const accuracies = testPrep.accuracyHistory.map((point) => point.accuracy);
  const averageAccuracy = accuracies.length > 0 ? Math.round(accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length) : null;
  const bestAccuracy = accuracies.length > 0 ? Math.max(...accuracies) : null;

  // ---- welcome copy: the "your interview's still open" nudge the
  // reference leads with stays, driven by a real open session.
  const displayName = profile?.full_name || user.email;
  const heading = openInterview
    ? `Your interview's still open, ${openInterview.role}. Want to finish it?`
    : `Welcome back${displayName ? `, ${displayName}` : ""}`;
  const subheading = openInterview ? "Pick up where you left off." : "Here's where your job search stands today.";

  return (
    <div className="flex flex-col gap-6">
      <WelcomeCard
        heading={heading}
        subheading={subheading}
        planLabel={planLabel}
        completion={completion}
        nudge={openInterview ? { label: "Resume interview", href: `/dashboard/interview/${openInterview.id}` } : undefined}
      />

      <StaggerContainer className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <OverviewMetricCard
            icon={FileTextIcon}
            label="CVs"
            value={activeCvs.length}
            caption={mostRecentCv ? `Latest: ${mostRecentCv.title} · ${daysAgoLabel(mostRecentCv.updatedAt)}` : "Build your first CV"}
            href="/dashboard/cvs"
          />
        </StaggerItem>
        <StaggerItem>
          <OverviewMetricCard
            icon={ScanSearchIcon}
            label="Latest ATS score"
            value={latestScoredCv?.atsScore ?? null}
            suffix="/100"
            empty="Not scanned yet"
            caption={latestScoredCv ? latestScoredCv.title : "Scan a CV to see your score"}
            href="/dashboard/ats-scanner"
          />
        </StaggerItem>
        <StaggerItem>
          <OverviewMetricCard
            icon={BriefcaseIcon}
            label="Applications"
            value={funnel.totalApplications}
            caption={`${appliedCount} applied · ${atInterviewStage} at interview`}
            href="/dashboard/applications"
          />
        </StaggerItem>
        <StaggerItem>
          <OverviewMetricCard
            icon={MessagesSquareIcon}
            label="Interviews practised"
            value={completedInterviews.length}
            caption={inProgressCount > 0 ? `${inProgressCount} in progress` : "Competency-style practice"}
            href="/dashboard/interview"
          />
        </StaggerItem>
      </StaggerContainer>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-full lg:col-span-2">
          <ApplicationsByStageCard funnel={funnel} />
        </div>
        <PlanUsageCard planLabel={planLabel} meters={planMeters} upgradeHref={planSlug === "free" ? "/dashboard/settings?tab=billing" : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <NextActionsCard actions={topActions} />
        <GettingStartedChecklist items={checklist} />
        {mostRecentCv ? (
          <ContinueEditingCard cv={mostRecentCv} />
        ) : (
          <DailyAtsActionCard />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InterviewsCard
          completed={completedInterviews.length}
          inProgress={inProgressCount}
          atInterviewStage={atInterviewStage}
          meters={interviewMeters}
          openInterview={openInterview ? { id: openInterview.id, role: openInterview.role } : null}
        />
        <SavedJobsCard total={savedJobs.total} sponsored={savedJobs.sponsored} latest={savedJobs.latest} />
        <SponsorActivityCard funnel={funnel} />
        <TestPrepInsightCard
          sessionCount={testPrep.accuracyHistory.length}
          averageAccuracy={averageAccuracy}
          bestAccuracy={bestAccuracy}
          weakArea={weakRecommendation && weakRecommendation.kind === "weak_subtype" ? weakRecommendation.subtype : null}
        />
      </div>

      <DailyPracticeCard />

      <section aria-labelledby="tools-heading" className="flex flex-col gap-4">
        <h2 id="tools-heading" className="font-heading text-2xl font-semibold tracking-tight">
          Your toolkit
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => {
            const access = accessByToolSlug.get(tool.slug);
            return access ? <ToolAccessCard key={tool.slug} tool={tool} access={access} stat={statsBySlug[tool.slug]} /> : null;
          })}
        </div>
      </section>

      <RecentActivityCard entries={activity} />
    </div>
  );
}
