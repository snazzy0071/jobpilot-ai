import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GraduateScheme } from "@/lib/graduate-schemes/types";

// Public, unauthenticated feature — always the anon-respecting client
// (src/lib/supabase/server.ts), never the service-role admin client,
// same rule src/lib/sponsors/queries.ts documents for the same reason.
// Unlike the sponsor register (~130k rows), this is a small, curated
// table with no automated feed, so there's no pagination or in-memory
// candidate-set cap here — every visible row is fetched once and
// filtered/sorted client-side (see grad-scheme-results.tsx).

const MAX_ROWS = 500;

type GraduateSchemeRow = {
  id: string;
  employer: string;
  scheme_name: string;
  sector: GraduateScheme["sector"];
  salary: string | null;
  locations: string[];
  sponsorship_status: GraduateScheme["sponsorshipStatus"];
  notes: string | null;
  source_url: string;
  source_date: string;
  verified_at: string;
};

function toGraduateScheme(row: GraduateSchemeRow): GraduateScheme {
  return {
    id: row.id,
    employer: row.employer,
    schemeName: row.scheme_name,
    sector: row.sector,
    salary: row.salary,
    locations: row.locations,
    sponsorshipStatus: row.sponsorship_status,
    notes: row.notes,
    sourceUrl: row.source_url,
    sourceDate: row.source_date,
    verifiedAt: row.verified_at,
  };
}

/** Every currently published graduate scheme, RLS-scoped to what an anonymous visitor's own request would see — filtering and sorting happen client-side against this full set (see this file's own header comment on why). */
export async function getGraduateSchemes(): Promise<GraduateScheme[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("graduate_schemes")
    .select("id, employer, scheme_name, sector, salary, locations, sponsorship_status, notes, source_url, source_date, verified_at")
    .order("employer", { ascending: true })
    .order("scheme_name", { ascending: true })
    .limit(MAX_ROWS);

  if (error) {
    console.error("getGraduateSchemes failed:", error.message);
    return [];
  }

  return (data ?? []).map(toGraduateScheme);
}

/** One scheme by id — the admin edit form's source of truth. Same public-read policy as getGraduateSchemes; requireAdmin() (src/lib/auth/session.ts) is what actually gates the /admin/graduate-schemes/[id]/edit route this is called from. */
export async function getGraduateSchemeById(id: string): Promise<GraduateScheme | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("graduate_schemes")
    .select("id, employer, scheme_name, sector, salary, locations, sponsorship_status, notes, source_url, source_date, verified_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return toGraduateScheme(data);
}
