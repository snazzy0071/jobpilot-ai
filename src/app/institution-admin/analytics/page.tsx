import { FileTextIcon, ScanSearchIcon, MessagesSquareIcon, ClipboardListIcon, ListChecksIcon, UsersIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireInstitutionAdmin } from "@/lib/auth/session";
import { getInstitutionAnalytics } from "@/lib/institutions/admin/queries";

export const dynamic = "force-dynamic";

function StatTile({ icon: Icon, label, value, caption }: { icon: typeof UsersIcon; label: string; value: string; caption?: string }) {
  return (
    <Card variant="metric" className="gap-1 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" /> {label}
      </div>
      <p className="font-heading text-2xl font-semibold tracking-tight">{value}</p>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}

/**
 * Every number on this page comes from get_institution_analytics()
 * (migration 0074) — six/seven pre-aggregated counts across the
 * student cohort (`institution_members` where `role = 'member'`),
 * never a single student's own activity. There is deliberately no
 * per-student table, list, or drill-down anywhere on this page — that
 * would defeat the point.
 */
export default async function InstitutionAdminAnalyticsPage() {
  const { institutionId } = await requireInstitutionAdmin();
  const analytics = await getInstitutionAnalytics(institutionId);

  if (analytics.suppressed) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Aggregate activity across your student cohort — never broken down by individual student.</p>
        </div>
        <Card variant="admin" className="gap-2 p-6" data-testid="analytics-suppressed">
          <p className="font-medium">
            {analytics.studentCount} student{analytics.studentCount === 1 ? "" : "s"} so far
          </p>
          <p className="text-sm text-muted-foreground">
            Activity figures appear once at least {analytics.minCohort} students have joined. With fewer, a total would describe individual students, so it is withheld to protect their privacy.
          </p>
        </Card>
      </div>
    );
  }

  const activationRate = analytics.studentCount > 0 ? Math.round((analytics.activatedStudents / analytics.studentCount) * 100) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Aggregate activity across your student cohort — never broken down by individual student.</p>
      </div>

      <Card variant="admin" className="gap-3 p-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Activated students</span>
          <span className="text-muted-foreground">
            {analytics.activatedStudents} / {analytics.studentCount}
            {activationRate !== null && ` (${activationRate}%)`}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${activationRate ?? 0}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">A student counts as activated once they&apos;ve built a CV, run an ATS scan, completed an interview, tracked an application, or completed a test-prep session.</p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={FileTextIcon} label="CVs built" value={`${analytics.cvsBuilt}`} />
        <StatTile icon={ScanSearchIcon} label="ATS scans" value={`${analytics.atsScans}`} />
        <StatTile icon={MessagesSquareIcon} label="Interviews completed" value={`${analytics.interviewsCompleted}`} />
        <StatTile icon={ClipboardListIcon} label="Applications tracked" value={`${analytics.applicationsTracked}`} />
        <StatTile icon={ListChecksIcon} label="Test sessions completed" value={`${analytics.testSessionsCompleted}`} />
        <StatTile icon={UsersIcon} label="Students" value={`${analytics.studentCount}`} caption="Excludes institution admins" />
      </div>
    </div>
  );
}
