import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SavedJob } from "@/lib/jobs/types";

export type SavedJobListItem = SavedJob & {
  /** Whether the listing is still live in the feed. False once it has expired, been retired or been pruned: the saved snapshot (and the posting link) outlive it. */
  listingLive: boolean;
  /** The application this job became in the tracker, if the user added it. */
  trackedApplicationId: string | null;
};

/**
 * The requesting user's saved jobs, newest first. saved_jobs is RLS-scoped to the user; the join to jobs only returns a
 * row for a listing that is still visible (active, unexpired, non-duplicate), which is exactly "still live". Throws on a
 * database error rather than returning an empty list: "you have no saved jobs" would be a wrong answer to an outage.
 */
export async function listSavedJobs(userId: string): Promise<SavedJobListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_jobs")
    .select("id, job_id, company_name, job_title, url, source_name, sponsor_status, match_score, notes, created_at, jobs(id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    console.error("listSavedJobs failed:", error?.message);
    throw new Error("Couldn't load your saved jobs.");
  }

  const trackedByJob = new Map<string, string>();
  const trackedByUrl = new Map<string, string>();
  const { data: applications } = await supabase.from("applications").select("id, job_id, url").eq("user_id", userId);
  for (const application of applications ?? []) {
    if (application.job_id) trackedByJob.set(application.job_id, application.id);
    if (application.url) trackedByUrl.set(application.url, application.id);
  }

  return data.map((row) => {
    const live = Array.isArray(row.jobs) ? row.jobs.length > 0 : !!row.jobs;
    return {
      id: row.id,
      jobId: row.job_id,
      companyName: row.company_name,
      jobTitle: row.job_title,
      url: row.url,
      sourceName: row.source_name,
      sponsorStatus: row.sponsor_status,
      matchScore: row.match_score,
      notes: row.notes,
      createdAt: row.created_at,
      listingLive: live,
      trackedApplicationId: (row.job_id ? trackedByJob.get(row.job_id) : undefined) ?? trackedByUrl.get(row.url) ?? null,
    };
  });
}
