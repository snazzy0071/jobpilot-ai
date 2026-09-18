"use server";

import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "@/lib/institutions/invite-token";
import { isSeatCapacityError } from "@/lib/institutions/errors";
import { redeemAccessCodeSchema, acceptInviteSchema } from "@/lib/institutions/enrollment/schemas";
import type { RedeemAccessCodeResult, AcceptInviteResult, DomainEnrollmentResult } from "@/lib/institutions/enrollment/types";

const NO_SEATS_MESSAGE = "Contact your institution administrator.";

/**
 * Lets an already signed-in user redeem an institution access code —
 * the same redeem_access_code() RPC signup already calls
 * (src/lib/auth/actions.ts), through the same service-role client, so
 * this and the signup path share one atomic, seat-capacity-checked
 * implementation rather than two. See migration 0073's own comment on
 * why a seat-capacity failure here rolls back the *entire* redemption
 * (including the code's own redemption_count) instead of burning it.
 */
export async function redeemInstitutionAccessCode(input: { code: string }): Promise<RedeemAccessCodeResult> {
  const user = await requireUser();

  const parsed = redeemAccessCodeSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter an access code." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_access_code", { p_code: parsed.data.code, p_user_id: user.id });

  if (error) {
    if (isSeatCapacityError(error.message)) {
      return { error: `This code is valid, but the institution has no seats available right now. ${NO_SEATS_MESSAGE}` };
    }
    return { error: "Couldn't redeem that code — try again." };
  }
  if (!data) return { error: "That access code is invalid, expired, or already used." };

  return { institutionId: data.institution_id, institutionJoined: data.institution_joined };
}

/**
 * Accepts an institution invite from its emailed link. The raw token
 * is hashed here and only ever compared by hash
 * (accept_institution_invite, migration 0072) — never stored or logged
 * raw. A reused, expired, or already-accepted token all come back as
 * the same plain "invalid" result (accept_institution_invite itself
 * doesn't distinguish them), so this can't be used to probe whether a
 * token merely expired vs. was already claimed by someone else.
 */
export async function acceptInstitutionInvite(input: { token: string }): Promise<AcceptInviteResult> {
  const user = await requireUser();

  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) return { error: "This invite link isn't valid." };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("accept_institution_invite", {
    p_token_hash: hashInviteToken(parsed.data.token),
    p_user_id: user.id,
  });

  if (error) {
    if (isSeatCapacityError(error.message)) {
      return { error: `This invite is valid, but the institution has no seats available right now. ${NO_SEATS_MESSAGE}` };
    }
    return { error: "Couldn't accept that invite — try again." };
  }
  if (!data) return { error: "That invite link is invalid, expired, or has already been used." };

  return { institutionId: data.institution_id, role: data.role };
}

/**
 * The explicit, user-triggered counterpart to handle_new_user()'s
 * best-effort signup-time attempt (migration 0073) — that one silently
 * swallows a seat-capacity failure rather than blocking account
 * creation over it; this is what lets someone retry later once their
 * institution's domain is verified, or once more seats exist.
 */
export async function checkDomainEnrollment(): Promise<DomainEnrollmentResult> {
  const user = await requireUser();

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("enroll_via_verified_domain", { p_user_id: user.id });

  if (error) {
    if (isSeatCapacityError(error.message)) {
      return { error: `Your institution's email domain matched, but there are no seats available right now. ${NO_SEATS_MESSAGE}` };
    }
    return { error: "Couldn't check your email domain — try again." };
  }
  if (!data?.matched) return { matched: false };

  return { matched: true, institutionId: data.institution_id, joined: data.joined };
}
