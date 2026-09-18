import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Application } from "@/lib/applications/types";

export const APPLICATION_SELECT_FIELDS =
  "id, job_id, cv_id, cover_letter_id, company_name, job_title, location, salary, url, deadline, status, notes, applied_at, sponsor_status, match_score, submitted_cv_version_id, frozen_at, created_at, updated_at";

export type ApplicationRow = {
  id: string;
  job_id: string | null;
  cv_id: string | null;
  cover_letter_id: string | null;
  company_name: string;
  job_title: string;
  location: string | null;
  salary: string | null;
  url: string | null;
  deadline: string | null;
  status: Application["status"];
  notes: string | null;
  applied_at: string | null;
  sponsor_status: Application["sponsorStatus"];
  match_score: number | null;
  submitted_cv_version_id: string | null;
  frozen_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toApplication(row: ApplicationRow): Application {
  return {
    id: row.id,
    jobId: row.job_id,
    cvId: row.cv_id,
    coverLetterId: row.cover_letter_id,
    companyName: row.company_name,
    jobTitle: row.job_title,
    location: row.location,
    salary: row.salary,
    url: row.url,
    deadline: row.deadline,
    status: row.status,
    notes: row.notes,
    appliedAt: row.applied_at,
    sponsorStatus: row.sponsor_status,
    matchScore: row.match_score,
    submittedCvVersionId: row.submitted_cv_version_id,
    frozenAt: row.frozen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every one of the requesting user's tracked applications, newest-updated first — the tracker list/board's own data source. RLS (`auth.uid() = user_id`) already scopes this; the explicit `.eq` is defence in depth, same as src/lib/cvs/queries.ts#listCvs. */
export async function listApplications(userId: string): Promise<Application[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_SELECT_FIELDS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toApplication);
}

/** One application, owner-checked via the explicit `.eq("user_id", ...)` (belt-and-braces alongside RLS) — the edit form's data source. */
export async function getApplicationById(userId: string, id: string): Promise<Application | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .select(APPLICATION_SELECT_FIELDS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return toApplication(data);
}
