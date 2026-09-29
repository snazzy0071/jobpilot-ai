import { requireUser } from "@/lib/auth/session";
import { listCvs } from "@/lib/cvs/queries";
import { CoverLetterCreateForm } from "@/components/cover-letters/cover-letter-create-form";

export const dynamic = "force-dynamic";

export default async function NewCoverLetterPage() {
  const user = await requireUser();
  const cvs = await listCvs(user.id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <CoverLetterCreateForm cvs={cvs} />
    </div>
  );
}
