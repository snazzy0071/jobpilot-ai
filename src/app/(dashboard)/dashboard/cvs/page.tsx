import { PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getLimit } from "@/lib/entitlements/service";
import { listCvsWithPreview } from "@/lib/cvs/queries";
import { CreateCvDialog } from "@/components/cvs/create-cv-dialog";
import { CvCard } from "@/components/cvs/cv-card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * reference/auth/cv-builder.png's list screen: a small "CV BUILDER"
 * eyebrow over a large title, "New CV" top-right, a dense card grid
 * with real per-CV thumbnails (see CvCard/CvThumbnail), and a trailing
 * dashed tile that opens the same create dialog. The reference also
 * shows an "Import existing CV" tile and a "past results from deleted
 * CVs" link — dropped, since neither a resume-import-to-CV feature nor
 * a CV trash/undelete feature exists in this app yet, and this task is
 * a presentation rebuild, not new backend functionality.
 */
export default async function CvsPage() {
  const user = await requireUser();
  const [cvs, templateLimit] = await Promise.all([listCvsWithPreview(user.id), getLimit(user.id, "cv_template_count")]);
  const active = cvs.filter((cv) => !cv.isArchived);
  const archived = cvs.filter((cv) => cv.isArchived);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">CV Builder</p>
          <h1 className="mt-1 font-heading text-4xl font-bold tracking-tight">Your CVs</h1>
          <p className="mt-1 text-muted-foreground">Create, tailor, and manage every version of your CV.</p>
        </div>
        <CreateCvDialog templateLimit={templateLimit} />
      </div>

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">You haven&apos;t created a CV yet.</p>
          <CreateCvDialog
            templateLimit={templateLimit}
            trigger={
              <Button className="mt-4">
                <PlusIcon /> New CV
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {active.map((cv) => (
            <CvCard key={cv.id} cv={cv} />
          ))}

          <CreateCvDialog
            templateLimit={templateLimit}
            trigger={
              <button
                type="button"
                className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-6 text-center transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PlusIcon className="size-5" />
                </span>
                <span className="font-heading text-sm font-semibold">Create from template</span>
                <span className="text-xs text-muted-foreground">
                  Pick from our 24 UK templates and rewrite your bullets with AI.
                </span>
                <span className="text-xs font-semibold text-primary">New CV</span>
              </button>
            }
          />
        </div>
      )}

      {archived.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-muted-foreground">Archived</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {archived.map((cv) => (
              <CvCard key={cv.id} cv={cv} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
