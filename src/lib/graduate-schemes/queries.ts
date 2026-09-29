import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { AssessmentType, GraduateScheme, SchemeAssessment } from "@/lib/graduate-schemes/types";

// Public, unauthenticated feature — always the anon-respecting client (src/lib/supabase/server.ts), never the
// service-role client, same rule src/lib/sponsors/queries.ts documents. RLS (migration 0111) lets everyone read published
// schemes and admins read drafts too, so the public functions below also filter `is_published` explicitly: an admin
// browsing the public site must see exactly what a visitor sees.
//
// This is a small, curated table with no automated feed, so the whole published set is fetched once and filtered, sorted
// and paginated in memory (src/lib/graduate-schemes/filter.ts) rather than paged in SQL.

const MAX_ROWS = 1000;

export const SCHEME_FIELDS =
  "id, slug, employer, scheme_name, sector, description, salary, salary_min, salary_max, locations, study_stages, opens_on, deadline_on, is_rolling, sponsorship_status, assessment_notes, application_url, notes, source_url, source_date, verified_at, is_published, updated_at, graduate_scheme_assessments(id, scheme_id, assessment_type, label, provider, notes, is_required, display_order, source_url, source_date, verified_at)";

type AssessmentRow = {
  id: string;
  scheme_id: string;
  assessment_type: AssessmentType;
  label: string | null;
  provider: string | null;
  notes: string | null;
  is_required: boolean;
  display_order: number;
  source_url: string;
  source_date: string;
  verified_at: string;
};

function toAssessment(row: AssessmentRow): SchemeAssessment {
  return {
    id: row.id,
    schemeId: row.scheme_id,
    type: row.assessment_type,
    label: row.label,
    provider: row.provider,
    notes: row.notes,
    isRequired: row.is_required,
    displayOrder: row.display_order,
    sourceUrl: row.source_url,
    sourceDate: row.source_date,
    verifiedAt: row.verified_at,
  };
}

type GraduateSchemeRow = {
  id: string;
  slug: string;
  employer: string;
  scheme_name: string;
  sector: GraduateScheme["sector"];
  description: string | null;
  salary: string | null;
  salary_min: number | null;
  salary_max: number | null;
  locations: string[];
  study_stages: GraduateScheme["studyStages"];
  opens_on: string | null;
  deadline_on: string | null;
  is_rolling: boolean;
  sponsorship_status: GraduateScheme["sponsorshipStatus"];
  graduate_scheme_assessments: AssessmentRow[] | null;
  assessment_notes: string | null;
  application_url: string | null;
  notes: string | null;
  source_url: string;
  source_date: string;
  verified_at: string;
  is_published: boolean;
  updated_at: string;
};

export function toGraduateScheme(row: GraduateSchemeRow): GraduateScheme {
  return {
    id: row.id,
    slug: row.slug,
    employer: row.employer,
    schemeName: row.scheme_name,
    sector: row.sector,
    description: row.description,
    salary: row.salary,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    locations: row.locations,
    studyStages: row.study_stages,
    opensOn: row.opens_on,
    deadlineOn: row.deadline_on,
    isRolling: row.is_rolling,
    sponsorshipStatus: row.sponsorship_status,
    // Required assessments first, then in the order the admin set.
    assessments: (row.graduate_scheme_assessments ?? []).map(toAssessment).sort((a, b) => Number(b.isRequired) - Number(a.isRequired) || a.displayOrder - b.displayOrder || a.type.localeCompare(b.type)),
    assessmentNotes: row.assessment_notes,
    applicationUrl: row.application_url,
    notes: row.notes,
    sourceUrl: row.source_url,
    sourceDate: row.source_date,
    verifiedAt: row.verified_at,
    isPublished: row.is_published,
    updatedAt: row.updated_at,
  };
}

/** Every published scheme, as an anonymous visitor would see it. A database error yields an empty list (logged), so a public page degrades instead of crashing. */
export async function getGraduateSchemes(): Promise<GraduateScheme[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("graduate_schemes")
    .select(SCHEME_FIELDS)
    .eq("is_published", true)
    .order("employer", { ascending: true })
    .order("scheme_name", { ascending: true })
    .limit(MAX_ROWS);

  if (error) {
    console.error("getGraduateSchemes failed:", error.message);
    return [];
  }
  return (data ?? []).map(toGraduateScheme);
}

/** One published scheme by its URL slug, or null (unknown, or a draft). */
export async function getPublishedSchemeBySlug(slug: string): Promise<GraduateScheme | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("graduate_schemes").select(SCHEME_FIELDS).eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) {
    // A database failure must not look like "no such scheme" (a 404 that search engines would keep).
    console.error("getPublishedSchemeBySlug failed:", error.message);
    throw new Error("Couldn't load that graduate scheme.");
  }
  if (!data) return null;
  return toGraduateScheme(data);
}

/** Every scheme including drafts — admin screens only (the page calling this sits behind requirePermission("manage_graduate_schemes")). */
export async function listAllGraduateSchemesForAdmin(): Promise<GraduateScheme[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("graduate_schemes").select(SCHEME_FIELDS).order("employer").order("scheme_name").limit(MAX_ROWS);
  if (error) {
    console.error("listAllGraduateSchemesForAdmin failed:", error.message);
    return [];
  }
  return (data ?? []).map(toGraduateScheme);
}

/** One scheme by id (drafts included) — the admin edit form's source of truth. */
export async function getGraduateSchemeById(id: string): Promise<GraduateScheme | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("graduate_schemes").select(SCHEME_FIELDS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toGraduateScheme(data);
}

/** One published scheme by id — used by the preparation actions, which are handed an id, never trusted to be published. */
export async function getPublishedSchemeById(id: string): Promise<GraduateScheme | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("graduate_schemes").select(SCHEME_FIELDS).eq("id", id).eq("is_published", true).maybeSingle();
  if (error) {
    // A database failure must not look like "no such scheme" (a 404 that search engines would keep).
    console.error("getPublishedSchemeById failed:", error.message);
    throw new Error("Couldn't load that graduate scheme.");
  }
  if (!data) return null;
  return toGraduateScheme(data);
}
