// Types for the institution-admin shell (src/lib/institutions/admin/
// {queries,actions}.ts) — every one of these is already scoped to a
// single institutionId, resolved server-side from
// requireInstitutionAdmin() (src/lib/auth/session.ts), never accepted
// from a client. "Institution admins only access their tenant" is
// enforced twice over here: RLS (migration 0072) for the regular
// client, and an explicit `.eq("institution_id", institutionId)` filter
// on every admin-client query below (listInstitutionMembers needs the
// service-role client to resolve emails — see its own comment — which
// bypasses RLS entirely, so that explicit filter is the *only* thing
// scoping it to one tenant).

import type { InstitutionMemberRole } from "@/lib/institutions/types";
import type { LicenceState } from "@/lib/institutions/licence";

export type AdminInstitutionMember = {
  id: string;
  userId: string;
  role: InstitutionMemberRole;
  joinedAt: string;
  fullName: string | null;
  email: string | null;
};

export type AdminInstitutionInvite = {
  id: string;
  email: string;
  role: InstitutionMemberRole;
  invitedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type InstitutionLicenceSummary = {
  id: string;
  planName: string;
  seatCount: number;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
  state: LicenceState;
};

export type InstitutionOverview = {
  institution: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
    welcomeMessage: string | null;
  };
  licence: InstitutionLicenceSummary | null;
  adminCount: number;
  memberCount: number;
  pendingInviteCount: number;
  seatsUsed: number;
  seatsTotal: number | null;
};

/**
 * Every field here is a pre-aggregated count produced by
 * get_institution_analytics() (migration 0074) — deliberately no field
 * on this type could ever carry a per-student number; there's nowhere
 * to put one. Scoped to `role = 'member'` (the actual student cohort)
 * — institution admin/staff accounts never contribute to these counts.
 */
export type InstitutionAnalytics = {
  studentCount: number;
  activatedStudents: number;
  cvsBuilt: number;
  atsScans: number;
  interviewsCompleted: number;
  applicationsTracked: number;
  testSessionsCompleted: number;
  /** True when the cohort is smaller than `minCohort`: the activity counts are withheld (they would describe individuals), only studentCount is real. */
  suppressed: boolean;
  minCohort: number;
};
