import { TestTypeForm } from "@/components/admin/test-type-form";

export default function NewTestTypePage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Add test type</h1>
        <p className="mt-1 text-muted-foreground">A practice category, e.g. &ldquo;Numerical Reasoning&rdquo;.</p>
      </div>

      <TestTypeForm />
    </div>
  );
}
