import { AssessmentImportForm } from "@/components/admin/assessment-import-form";

export default function ImportAssessmentsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Import assessment mappings</h1>
        <p className="mt-1 text-muted-foreground">Paste CSV rows linking existing schemes to the assessments they use, each with its source.</p>
      </div>
      <AssessmentImportForm />
    </div>
  );
}
