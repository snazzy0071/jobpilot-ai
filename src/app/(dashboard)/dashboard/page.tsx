import { requireUser, getCurrentProfile } from "@/lib/auth/session";
import { getAllToolAccessStates } from "@/lib/entitlements/tool-access";
import { listCvs } from "@/lib/cvs/queries";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { listInterviewSessions } from "@/lib/interviews/queries";
import { listLinkedinDrafts } from "@/lib/linkedin/queries";
import { ToolAccessCard, type ToolStat } from "@/components/entitlements/tool-access-card";
import { GettingStartedChecklist, type ChecklistItem } from "@/components/dashboard/getting-started-checklist";
import { ContinueEditingCard } from "@/components/dashboard/continue-editing-card";
import { DailyAtsActionCard } from "@/components/dashboard/daily-ats-action-card";
import { TOOLS } from "@/config/tools";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [profile, accessStates, cvs, coverLetters, interviewSessions, linkedinDrafts] = await Promise.all([
    getCurrentProfile(),
    getAllToolAccessStates(user.id),
    listCvs(user.id),
    listCoverLetters(user.id),
    listInterviewSessions(user.id),
    listLinkedinDrafts(user.id),
  ]);

  const accessByToolSlug = new Map(accessStates.map((state) => [state.toolSlug, state]));
  const activeCvs = cvs.filter((cv) => !cv.isArchived);
  const mostRecentCv = activeCvs[0] ?? null; // listCvs already orders by updated_at desc.
  const completedInterviewCount = interviewSessions.filter((session) => session.status === "completed").length;
  const hasAtsScan = activeCvs.some((cv) => cv.atsScore !== null);
  // listInterviewSessions already orders by created_at desc, so the first
  // in-progress hit is the most recent one — the same "still open" nudge
  // reference/auth/dashboard.png leads with, driven by a real session
  // instead of a static greeting.
  const openInterview = interviewSessions.find((session) => session.status === "in_progress") ?? null;

  // Real stats only — a tool with no number here (Job Tracker, Job
  // Match, Grad Scheme Prep) simply isn't built yet (see
  // docs/SCREENSHOT_MAP.md), so it gets no stat rather than a fabricated
  // one, matching reference/auth/dashboard.png's own "some cards have a
  // number, some just have the arrow" pattern.
  const statsBySlug: Partial<Record<string, ToolStat>> = {
    cv: { value: String(activeCvs.length), unit: activeCvs.length === 1 ? "CV" : "CVs" },
    "cover-letter": { value: String(coverLetters.length), unit: coverLetters.length === 1 ? "letter" : "letters" },
    ...(completedInterviewCount > 0 && { interview: { value: String(completedInterviewCount), unit: "done" } }),
    ...(mostRecentCv?.atsScore != null && { ats: { value: String(mostRecentCv.atsScore), unit: "/100" } }),
    ...(linkedinDrafts.length > 0 && { linkedin: { value: String(linkedinDrafts.length), unit: linkedinDrafts.length === 1 ? "draft" : "drafts" } }),
  };

  const checklist: ChecklistItem[] = [
    { label: "Build your CV", done: activeCvs.length > 0 },
    { label: "Run your first ATS scan", done: hasAtsScan },
    { label: "Practise an interview", done: completedInterviewCount > 0 },
    { label: "Optimise your LinkedIn profile", done: linkedinDrafts.length > 0 },
  ];

  const displayName = profile?.full_name || user.email;

  return (
    <div className="flex flex-col gap-8">
      <div>
        {openInterview ? (
          <>
            <h1 className="font-heading text-4xl font-bold tracking-tight">
              Your interview&apos;s still open, {openInterview.role}. Want to finish it?
            </h1>
            <p className="mt-1 text-muted-foreground">Pick up where you left off.</p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-4xl font-bold tracking-tight">
              Welcome back{displayName ? `, ${displayName}` : ""}
            </h1>
            <p className="mt-1 text-muted-foreground">Here&apos;s an overview of your toolkit.</p>
          </>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((tool) => {
          const access = accessByToolSlug.get(tool.slug);
          return access ? (
            <ToolAccessCard key={tool.slug} tool={tool} access={access} stat={statsBySlug[tool.slug]} />
          ) : null;
        })}
      </div>

      <GettingStartedChecklist items={checklist} />

      {mostRecentCv && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <ContinueEditingCard cv={mostRecentCv} />
          {mostRecentCv.atsScore === null && <DailyAtsActionCard />}
        </div>
      )}
    </div>
  );
}
