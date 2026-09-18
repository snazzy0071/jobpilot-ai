import { GraduateSchemeForm } from "@/components/admin/graduate-scheme-form";

export default function NewGraduateSchemePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Add graduate scheme</h1>
        <p className="mt-1 text-muted-foreground">
          Every status here needs a real source — link the page it was checked against.
        </p>
      </div>

      <GraduateSchemeForm />
    </div>
  );
}
