import { notFound } from "next/navigation";
import { AssessmentManager } from "@/components/admin/assessment-manager";
import { GraduateSchemeForm } from "@/components/admin/graduate-scheme-form";
import { getGraduateSchemeById } from "@/lib/graduate-schemes/queries";

export const dynamic = "force-dynamic";

export default async function EditGraduateSchemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scheme = await getGraduateSchemeById(id);
  if (!scheme) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Edit graduate scheme</h1>
        <p className="mt-1 text-muted-foreground">{scheme.employer} — {scheme.schemeName}</p>
      </div>

      <GraduateSchemeForm scheme={scheme} />
      <AssessmentManager schemeId={scheme.id} assessments={scheme.assessments} schemeSourceUrl={scheme.sourceUrl} />
    </div>
  );
}
