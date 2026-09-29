import Link from "next/link";
import { IdCardIcon, PlusIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listLinkedinDrafts } from "@/lib/linkedin/queries";
import { LINKEDIN_TARGET_SENIORITY_LABELS } from "@/lib/linkedin/types";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export default async function LinkedinDraftsPage() {
  const user = await requireUser();
  const drafts = await listLinkedinDrafts(user.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <Button render={<Link href="/dashboard/linkedin/new"><PlusIcon /> New draft</Link>} />
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          icon={IdCardIcon}
          title="You haven't created a LinkedIn draft yet"
          description="Paste your current headline, About and Experience, and get a rewrite tuned for how UK recruiters actually search."
          actions={<Button render={<Link href="/dashboard/linkedin/new"><PlusIcon /> New draft</Link>} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((draft) => (
            <Link key={draft.id} href={`/dashboard/linkedin/${draft.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader>
                  <CardTitle className="text-base">{draft.title}</CardTitle>
                  <CardDescription>{draft.targetRole}</CardDescription>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="secondary">{LINKEDIN_TARGET_SENIORITY_LABELS[draft.targetSeniority]}</Badge>
                    {!draft.hasGenerated && <Badge variant="outline">Not generated</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Updated {formatDate(draft.updatedAt)}</p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
