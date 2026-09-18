// Canonical source for the institutions domain — mirrors migration
// 0072's real Postgres shape (public.institutions / institution_members
// / institution_licences / institution_domains / institution_invites).
// See that migration's own header comment for why seat capacity isn't
// a stored count here but an enforced DB constraint instead, and why
// institution_licences has no client-writable fields reflected in any
// action layer yet — this module is schema + types only; CRUD/UI is
// its own later task, same as every other schema-first module this
// project has shipped (applications, test-prep).

export const INSTITUTION_MEMBER_ROLES = ["admin", "member"] as const;
export type InstitutionMemberRole = (typeof INSTITUTION_MEMBER_ROLES)[number];

export type Institution = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string | null;
  welcomeMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InstitutionMember = {
  id: string;
  institutionId: string;
  userId: string;
  role: InstitutionMemberRole;
  joinedAt: string;
};

export type InstitutionLicence = {
  id: string;
  institutionId: string;
  planId: string;
  seatCount: number;
  startsAt: string;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InstitutionDomain = {
  id: string;
  institutionId: string;
  domain: string;
  isVerified: boolean;
  createdAt: string;
};

/**
 * The public-facing shape — never includes `tokenHash` (nothing ever
 * reads it back out; a raw token is only ever compared by its hash
 * inside accept_institution_invite, migration 0072). `email`/`role` are
 * what an admin-facing invite list would show; acceptance itself only
 * ever needs the raw token from the invite link, never this row.
 */
export type InstitutionInvite = {
  id: string;
  institutionId: string;
  email: string;
  role: InstitutionMemberRole;
  invitedBy: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  createdAt: string;
};
