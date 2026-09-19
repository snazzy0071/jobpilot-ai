import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements/service";
import { getApplicationFunnelAnalytics, type ApplicationFunnelAnalytics } from "@/lib/applications/analytics";
import { listApplications } from "@/lib/applications/queries";
import { getTestPrepInsights, type TestPrepInsights } from "@/lib/test-prep/analytics";
import type { Application } from "@/lib/applications/types";

// Everything the dashboard overview shows that isn't already fetched by
// its own page (CVs, cover letters, interviews, LinkedIn drafts, tool
// access states) — every number is a real read of this user's own rows,
// with the explicit `.eq("user_id", ...)` these queries all carry as
// defence in depth on top of RLS. Deliberately no fabricated fallback
// anywhere: a missing table row or failed read becomes an empty/`null`
// value the UI renders as an honest empty state, never a placeholder
// figure.

export type UserPreferencesSnapshot = {
  targetRoles: string[];
  careerStage: string | null;
  location: string | null;
  graduationYear: number | null;
  visaSponsorshipPreference: string | null;
};

export type SavedJobPreview = {
  id: string;
  companyName: string;
  jobTitle: string;
  sponsorStatus: string;
  matchScore: number | null;
  createdAt: string;
};

export type DashboardOverviewData = {
  planSlug: string;
  preferences: UserPreferencesSnapshot;
  savedJobs: { total: number; sponsored: number; latest: SavedJobPreview[] };
  funnel: ApplicationFunnelAnalytics;
  applications: Application[];
  testPrep: TestPrepInsights;
};

export async function getDashboardOverview(userId: string): Promise<DashboardOverviewData> {
  const supabase = await createClient();

  const [entitlements, prefsResult, savedResult, funnel, applications, testPrep] = await Promise.all([
    getEntitlements(userId),
    supabase
      .from("user_preferences")
      .select("target_roles, career_stage, location, graduation_year, visa_sponsorship_preference")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("saved_jobs")
      .select("id, company_name, job_title, sponsor_status, match_score, created_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    getApplicationFunnelAnalytics(userId),
    listApplications(userId),
    getTestPrepInsights(userId),
  ]);

  const prefs = prefsResult.data as {
    target_roles: string[] | null;
    career_stage: string | null;
    location: string | null;
    graduation_year: number | null;
    visa_sponsorship_preference: string | null;
  } | null;

  const savedRows = (savedResult.data ?? []) as {
    id: string;
    company_name: string;
    job_title: string;
    sponsor_status: string;
    match_score: number | null;
    created_at: string;
  }[];

  return {
    planSlug: entitlements.planSlug,
    preferences: {
      targetRoles: prefs?.target_roles ?? [],
      careerStage: prefs?.career_stage ?? null,
      location: prefs?.location ?? null,
      graduationYear: prefs?.graduation_year ?? null,
      visaSponsorshipPreference: prefs?.visa_sponsorship_preference ?? null,
    },
    savedJobs: {
      total: savedResult.count ?? savedRows.length,
      sponsored: savedRows.filter((row) => row.sponsor_status === "confirmed_sponsor").length,
      latest: savedRows.slice(0, 3).map((row) => ({
        id: row.id,
        companyName: row.company_name,
        jobTitle: row.job_title,
        sponsorStatus: row.sponsor_status,
        matchScore: row.match_score,
        createdAt: row.created_at,
      })),
    },
    funnel,
    applications,
    testPrep,
  };
}
