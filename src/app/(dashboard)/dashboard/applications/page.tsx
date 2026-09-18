import Link from "next/link";
import { BarChart3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationTrackerBoard } from "@/components/applications/application-tracker-board";
import { requireUser } from "@/lib/auth/session";
import { listApplications } from "@/lib/applications/queries";
import { listCvs } from "@/lib/cvs/queries";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await requireUser();
  const [applications, cvs] = await Promise.all([listApplications(user.id), listCvs(user.id)]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="mt-1 text-muted-foreground">
            {applications.length} tracked application{applications.length === 1 ? "" : "s"} — drag a card between
            columns, or use its status menu.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/dashboard/applications/analytics" />}>
            <BarChart3 className="size-4" /> Analytics
          </Button>
          <Button render={<Link href="/dashboard/applications/new" />}>
            <Plus className="size-4" /> Add application
          </Button>
        </div>
      </div>

      <ApplicationTrackerBoard applications={applications} cvs={cvs.map((cv) => ({ id: cv.id, title: cv.title }))} />
    </div>
  );
}
