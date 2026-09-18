import { requireUser } from "@/lib/auth/session";
import { listCvs } from "@/lib/cvs/queries";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { ApplicationForm } from "@/components/applications/application-form";

export const dynamic = "force-dynamic";

export default async function NewApplicationPage() {
  const user = await requireUser();
  const [cvs, coverLetters] = await Promise.all([listCvs(user.id), listCoverLetters(user.id)]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Add application</h1>
        <p className="mt-1 text-muted-foreground">Track a role you&apos;ve applied to, or one you&apos;re planning to.</p>
      </div>

      <ApplicationForm
        cvs={cvs.map((cv) => ({ id: cv.id, title: cv.title }))}
        coverLetters={coverLetters.map((letter) => ({ id: letter.id, companyName: letter.companyName, jobTitle: letter.jobTitle }))}
      />
    </div>
  );
}
