import { LinkedinDraftCreateForm } from "@/components/linkedin/linkedin-draft-create-form";

export const dynamic = "force-dynamic";

export default function NewLinkedinDraftPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">New LinkedIn draft</h1>
        <p className="mt-1 text-muted-foreground">
          No LinkedIn sign-in needed — paste your current profile text below and choose a target role and seniority.
        </p>
      </div>

      <LinkedinDraftCreateForm />
    </div>
  );
}
