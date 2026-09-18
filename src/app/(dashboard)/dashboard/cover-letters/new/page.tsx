import { requireUser } from "@/lib/auth/session";
import { listCvs } from "@/lib/cvs/queries";
import { CoverLetterCreateForm } from "@/components/cover-letters/cover-letter-create-form";

export const dynamic = "force-dynamic";

export default async function NewCoverLetterPage() {
  const user = await requireUser();
  const cvs = await listCvs(user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">New cover letter</h1>
        <p className="mt-1 text-muted-foreground">
          Choose a CV, add the job details, and generate a draft grounded only in what&apos;s actually on that CV.
        </p>
      </div>

      <CoverLetterCreateForm cvs={cvs} />
    </div>
  );
}
