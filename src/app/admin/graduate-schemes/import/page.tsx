import { GraduateSchemeImportForm } from "@/components/admin/graduate-scheme-import-form";

export default function ImportGraduateSchemesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Import graduate schemes</h1>
        <p className="mt-1 text-muted-foreground">
          Paste CSV rows to bulk-create or update schemes. Existing rows are matched by employer + scheme name.
        </p>
      </div>

      <GraduateSchemeImportForm />
    </div>
  );
}
