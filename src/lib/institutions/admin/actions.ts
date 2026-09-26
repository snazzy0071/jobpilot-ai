"use server";

import { revalidatePath } from "next/cache";
import { requireInstitutionAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { renderEmailLayout, emailHeading, emailParagraph, emailButton } from "@/lib/email/layout";
import { siteConfig } from "@/config/site";
import { generateInviteToken, hashInviteToken } from "@/lib/institutions/invite-token";
import { isSeatCapacityError } from "@/lib/institutions/errors";
import {
  updateBrandingSchema,
  createInviteSchema,
  updateMemberRoleSchema,
  memberIdSchema,
  inviteIdSchema,
  claimDomainSchema,
  domainIdSchema,
} from "@/lib/institutions/admin/schemas";

const INVITE_VALIDITY_MS = 14 * 24 * 60 * 60 * 1000;

function buildInviteEmailHtml(institutionName: string, link: string): string {
  return renderEmailLayout({
    previewText: `You're invited to join ${institutionName} on ${siteConfig.name}`,
    bodyHtml: [
      emailHeading(`You're invited to join ${institutionName}`),
      emailParagraph("Click below to accept this invite. It expires in 14 days."),
      emailButton("Accept invite", link),
    ].join(""),
  });
}

/**
 * Full-row update — institutions' own "Institution admins can update
 * their own institution" policy (migration 0072) already allows this;
 * `institutionId` comes from requireInstitutionAdmin(), never a form
 * field, so there's no way for this to target a different tenant even
 * before RLS gets a chance to reject it.
 */
export async function updateInstitutionBranding(_prevState: unknown, formData: FormData) {
  const { institutionId } = await requireInstitutionAdmin();

  const parsed = updateBrandingSchema.safeParse({
    name: formData.get("name"),
    logoUrl: formData.get("logoUrl"),
    primaryColor: formData.get("primaryColor"),
    welcomeMessage: formData.get("welcomeMessage"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("institutions")
    .update({
      name: parsed.data.name,
      logo_url: parsed.data.logoUrl,
      primary_color: parsed.data.primaryColor,
      welcome_message: parsed.data.welcomeMessage,
    })
    .eq("id", institutionId);
  if (error) return { error: "Couldn't save branding — try again." };

  revalidatePath("/institution-admin/branding");
  revalidatePath("/institution-admin");
}

/**
 * Blocks an admin from demoting themselves out of the role while
 * they're the institution's only admin — not a security boundary (RLS
 * would still reject anything cross-tenant regardless), just a real
 * lockout this UI shouldn't let happen: a self-managed tenant with zero
 * admins left has no way back in short of JobPilot support.
 */
export async function updateMemberRole(_prevState: unknown, formData: FormData) {
  const { user, institutionId } = await requireInstitutionAdmin();

  const parsed = updateMemberRoleSchema.safeParse({
    memberId: formData.get("memberId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("institution_members")
    .select("id, user_id, role")
    .eq("id", parsed.data.memberId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!target) return { error: "That member couldn't be found." };

  if (target.user_id === user.id && parsed.data.role === "member") {
    const { count } = await supabase
      .from("institution_members")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) return { error: "You're the only administrator — promote someone else first." };
  }

  const { error } = await supabase
    .from("institution_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.memberId)
    .eq("institution_id", institutionId);
  if (error) return { error: "Couldn't update that member's role — try again." };

  revalidatePath("/institution-admin/members");
}

/** Same self-lockout guard as updateMemberRole above, for removal instead of demotion. */
export async function removeInstitutionMember(_prevState: unknown, formData: FormData) {
  const { user, institutionId } = await requireInstitutionAdmin();

  const parsed = memberIdSchema.safeParse({ memberId: formData.get("memberId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("institution_members")
    .select("id, user_id, role")
    .eq("id", parsed.data.memberId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!target) return { error: "That member couldn't be found." };

  if (target.user_id === user.id && target.role === "admin") {
    const { count } = await supabase
      .from("institution_members")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("role", "admin");
    if ((count ?? 0) <= 1) return { error: "You're the only administrator — promote someone else before removing yourself." };
  }

  const { error } = await supabase
    .from("institution_members")
    .delete()
    .eq("id", parsed.data.memberId)
    .eq("institution_id", institutionId);
  if (error) return { error: "Couldn't remove that member — try again." };

  revalidatePath("/institution-admin/members");
  revalidatePath("/institution-admin");
  revalidatePath("/institution-admin/seats");
}

/**
 * Generates a fresh token (only its hash is ever stored — src/lib/
 * institutions/invite-token.ts), inserts the invite, then sends the
 * real email. institution_invites_pending_email_idx (migration 0072)
 * turns a duplicate still-pending invite for the same email into a
 * 23505 unique-violation rather than a silent second row; a seat-
 * capacity failure (enforce_institution_seat_capacity, migration 0073)
 * surfaces as its own specific message. A failed *email send* doesn't
 * roll back the invite — it's already a fully valid row either way,
 * just one the admin may need to resend (resendInstitutionInvite,
 * below) or share manually.
 */
export async function createInstitutionInvite(formData: FormData) {
  const { user, institutionId } = await requireInstitutionAdmin();

  const parsed = createInviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: institution } = await supabase.from("institutions").select("name").eq("id", institutionId).maybeSingle();
  if (!institution) return { error: "Institution not found." };

  const rawToken = generateInviteToken();

  const { error } = await supabase.from("institution_invites").insert({
    institution_id: institutionId,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: hashInviteToken(rawToken),
    invited_by: user.id,
  });

  if (error) {
    if (error.code === "23505") return { error: "There's already a pending invite for that email." };
    if (isSeatCapacityError(error.message)) return { error: "No seats remaining on your institution's licence." };
    return { error: "Couldn't create that invite — try again." };
  }

  try {
    await sendEmail({
      to: parsed.data.email,
      subject: `You're invited to join ${institution.name} on JobPilot AI`,
      html: buildInviteEmailHtml(institution.name, `${siteConfig.domain}/institution-invite/${rawToken}`),
      template: "institution_invite",
    });
  } catch {
    // Non-fatal — see this function's own comment above.
  }

  revalidatePath("/institution-admin/invites");
  revalidatePath("/institution-admin");
  revalidatePath("/institution-admin/seats");
}

export async function revokeInstitutionInvite(_prevState: unknown, formData: FormData) {
  const { institutionId } = await requireInstitutionAdmin();

  const parsed = inviteIdSchema.safeParse({ inviteId: formData.get("inviteId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.from("institution_invites").delete().eq("id", parsed.data.inviteId).eq("institution_id", institutionId);
  if (error) return { error: "Couldn't revoke that invite — try again." };

  revalidatePath("/institution-admin/invites");
  revalidatePath("/institution-admin");
  revalidatePath("/institution-admin/seats");
}

/** Regenerates the token/expiry on the *same* invite row (rather than revoke-and-recreate) so its id/history stay stable, then resends the email. */
export async function resendInstitutionInvite(_prevState: unknown, formData: FormData) {
  const { institutionId } = await requireInstitutionAdmin();

  const parsed = inviteIdSchema.safeParse({ inviteId: formData.get("inviteId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();

  const { data: invite } = await supabase
    .from("institution_invites")
    .select("id, email, accepted_at")
    .eq("id", parsed.data.inviteId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!invite) return { error: "That invite couldn't be found." };
  if (invite.accepted_at) return { error: "That invite has already been accepted." };

  const { data: institution } = await supabase.from("institutions").select("name").eq("id", institutionId).maybeSingle();

  const rawToken = generateInviteToken();
  const newExpiresAt = new Date(Date.now() + INVITE_VALIDITY_MS).toISOString();

  const { error } = await supabase
    .from("institution_invites")
    .update({ token_hash: hashInviteToken(rawToken), expires_at: newExpiresAt })
    .eq("id", invite.id);
  if (error) return { error: "Couldn't resend that invite — try again." };

  try {
    await sendEmail({
      to: invite.email,
      subject: `You're invited to join ${institution?.name ?? "your institution"} on JobPilot AI`,
      html: buildInviteEmailHtml(institution?.name ?? "your institution", `${siteConfig.domain}/institution-invite/${rawToken}`),
      template: "institution_invite",
    });
  } catch {
    // Non-fatal — see createInstitutionInvite's own comment.
  }

  revalidatePath("/institution-admin/invites");
}

/**
 * Claims an email domain for this institution. The claim starts UNVERIFIED and does nothing until a JobPilot admin verifies it
 * (the database refuses a self-verified claim — migration 0119); only then does anyone with a confirmed address at that domain get
 * a seat automatically. A domain can belong to one institution only.
 */
export async function claimInstitutionDomain(formData: FormData) {
  const { institutionId } = await requireInstitutionAdmin();

  const parsed = claimDomainSchema.safeParse({ domain: formData.get("domain") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("institution_domains").insert({ institution_id: institutionId, domain: parsed.data.domain, is_verified: false });
  if (error) {
    if (error.code === "23505") return { error: "That domain is already claimed." };
    return { error: "Couldn't claim that domain — try again." };
  }

  revalidatePath("/institution-admin/domains");
}

export async function removeInstitutionDomain(_prevState: unknown, formData: FormData) {
  const { institutionId } = await requireInstitutionAdmin();

  const parsed = domainIdSchema.safeParse({ domainId: formData.get("domainId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.from("institution_domains").delete().eq("id", parsed.data.domainId).eq("institution_id", institutionId);
  if (error) return { error: "Couldn't remove that domain — try again." };

  revalidatePath("/institution-admin/domains");
}
