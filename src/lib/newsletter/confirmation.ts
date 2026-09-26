import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInviteToken, hashInviteToken } from "@/lib/institutions/invite-token";
import { decideConfirmation, type ConfirmationOutcome } from "@/lib/newsletter/confirmation-rules";

// Same token scheme as institution invites: 256 random bits, only the SHA-256 hash is stored.
export const generateConfirmationToken = generateInviteToken;
export const hashConfirmationToken = hashInviteToken;

/** Opens the emailed link: turns a pending subscription into a confirmed one. Idempotent, and never reveals whether an address is subscribed. */
export async function confirmSubscriptionByToken(token: string): Promise<ConfirmationOutcome> {
  if (!token || token.length > 200) return "invalid";
  const admin = createAdminClient();
  const hash = hashConfirmationToken(token);
  const { data: row } = await admin.from("newsletter_subscribers").select("id, status, confirmation_sent_at").eq("confirm_token_hash", hash).maybeSingle();

  const outcome = decideConfirmation(row);
  if (outcome !== "confirmed" || !row) return outcome;

  const now = new Date().toISOString();
  const { error } = await admin
    .from("newsletter_subscribers")
    .update({ status: "subscribed", confirmed_at: now, subscribed_at: now })
    .eq("id", row.id)
    .eq("status", "pending");
  return error ? "invalid" : "confirmed";
}
