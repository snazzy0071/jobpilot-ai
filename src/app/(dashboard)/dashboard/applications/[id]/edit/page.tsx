import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { listCvs } from "@/lib/cvs/queries";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { getApplicationById, listApplicationHistory, getSubmittedCvVersion } from "@/lib/applications/queries";
import { ApplicationHistory } from "@/components/applications/application-history";
import { DeleteApplicationButton } from "@/components/applications/delete-application-button";
import { listRemindersForApplication } from "@/lib/applications/reminders/queries";
import { ApplicationForm } from "@/components/applications/application-form";
import { ApplicationReminders } from "@/components/applications/application-reminders";

export const dynamic = "force-dynamic";

export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [application, cvs, coverLetters] = await Promise.all([
    getApplicationById(user.id, id),
    listCvs(user.id),
    listCoverLetters(user.id),
  ]);
  if (!application) notFound();

  const [reminders, history, submittedCv] = await Promise.all([
    listRemindersForApplication(application.id),
    listApplicationHistory(user.id, application.id),
    application.submittedCvVersionId ? getSubmittedCvVersion(user.id, application.submittedCvVersionId) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit application</h1>
        <p className="mt-1 text-muted-foreground">
          {application.companyName} — {application.jobTitle}
        </p>
      </div>

      <ApplicationForm
        application={application}
        cvs={cvs.map((cv) => ({ id: cv.id, title: cv.title }))}
        coverLetters={coverLetters.map((letter) => ({ id: letter.id, companyName: letter.companyName, jobTitle: letter.jobTitle }))}
        submittedCv={submittedCv}
      />

      <ApplicationHistory entries={history} />

      <ApplicationReminders applicationId={application.id} reminders={reminders} />

      <div className="border-t pt-6">
        <DeleteApplicationButton id={application.id} companyName={application.companyName} jobTitle={application.jobTitle} />
      </div>
    </div>
  );
}
