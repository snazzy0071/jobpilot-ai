import Link from "next/link";
import { BarChart3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationTrackerBoard } from "@/components/applications/application-tracker-board";
import { requireUser } from "@/lib/auth/session";
import { listApplications } from "@/lib/applications/queries";
import { listCvs } from "@/lib/cvs/queries";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { getReminderSummaryByApplication, listDueInAppReminders } from "@/lib/applications/reminders/queries";
import { DueReminders } from "@/components/applications/due-reminders";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await requireUser();
  const [applications, cvs, coverLetters, reminderSummary, dueReminders] = await Promise.all([
    listApplications(user.id),
    listCvs(user.id),
    listCoverLetters(user.id),
    getReminderSummaryByApplication(user.id),
    listDueInAppReminders(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/dashboard/applications/analytics" />}>
            <BarChart3 className="size-4" /> Analytics
          </Button>
          <Button render={<Link href="/dashboard/applications/new" />}>
            <Plus className="size-4" /> Add application
          </Button>
        </div>
      </div>

      <DueReminders reminders={dueReminders} />

      <ApplicationTrackerBoard
        applications={applications}
        cvs={cvs.map((cv) => ({ id: cv.id, title: cv.title }))}
        coverLetters={coverLetters.map((letter) => ({ id: letter.id, companyName: letter.companyName, jobTitle: letter.jobTitle }))}
        reminders={reminderSummary}
      />
    </div>
  );
}
