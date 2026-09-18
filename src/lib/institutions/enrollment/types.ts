// Types for the three enrollment paths (src/lib/institutions/enrollment/
// actions.ts) — distinct from src/lib/institutions/types.ts's own
// stored-row shapes.

import type { InstitutionMemberRole } from "@/lib/institutions/types";

/**
 * `institutionJoined` is false (not an error) when the code's own
 * institution_id was present but the caller already belongs to a
 * *different* institution — the code still redeemed (plan granted if
 * any), it just didn't move an existing membership. See migration
 * 0073's own comment on why that's the right default for this path.
 */
export type RedeemAccessCodeResult =
  | { error: string }
  | { institutionId: string | null; institutionJoined: boolean };

export type AcceptInviteResult = { error: string } | { institutionId: string; role: InstitutionMemberRole };

/** `matched: true, joined: false` mirrors RedeemAccessCodeResult's own institutionJoined nuance — the domain matched, but the caller already belongs elsewhere. */
export type DomainEnrollmentResult = { error: string } | { matched: false } | { matched: true; institutionId: string; joined: boolean };
