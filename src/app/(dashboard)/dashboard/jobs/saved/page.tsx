import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listSavedJobs, type SavedJobListItem } from "@/lib/jobs/wishlist/queries";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { JobsSectionNav } from "@/components/jobs/jobs-section-nav";
import { SavedJobCard } from "@/components/jobs/saved-job-card";

export const dynamic = "force-dynamic";

export default async function SavedJobsPage() {
  const user = await requireUser();

  let items: SavedJobListItem[] = [];
  let failed = false;
  try {
    items = await listSavedJobs(user.id);
  } catch {
    failed = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Saved jobs</h1>
        <p className="mt-1 text-muted-foreground">
          Jobs you bookmarked from the feed. Each keeps what it looked like when you saved it, even after the listing closes.
        </p>
      </div>

      <JobsSectionNav active="saved" />

      {failed ? (
        <Card className="items-center gap-2 p-10 text-center" role="alert">
          <p className="font-medium">Your saved jobs couldn&apos;t be loaded</p>
          <p className="max-w-md text-sm text-muted-foreground">Try refreshing in a moment — your saved jobs are not lost.</p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="items-center gap-3 p-10 text-center">
          <p className="font-medium">No saved jobs yet</p>
          <p className="max-w-md text-sm text-muted-foreground">Use Save on a job in the feed to keep it here, then add it to your tracker when you decide to apply.</p>
          <Button render={<Link href="/dashboard/jobs" />}>Browse the job feed</Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground" data-testid="saved-total">
            {items.length} saved job{items.length === 1 ? "" : "s"}
          </p>
          {items.map((item) => (
            <SavedJobCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
