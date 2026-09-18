import type { InstitutionMemberRole } from "@/lib/institutions/types";

export type AdminUserRole = "user" | "institution_admin" | "admin";

export type AdminUserListItem = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: AdminUserRole;
  /** "free" when there's no subscriptions row at all — never the legacy `profiles.plan` display flag (migration 0051's own comment: that column is a fallback for one UI surface, not a real entitlement source). */
  planSlug: string;
  /** Null means no subscriptions row exists yet (never subscribed) — distinct from any real Stripe status. */
  subscriptionStatus: string | null;
  createdAt: string;
};

export type AdminUserSubscriptionDetail = {
  planName: string;
  status: string;
  billingCycle: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type AdminUserInstitutionDetail = {
  id: string;
  name: string;
  role: InstitutionMemberRole;
};

export type AdminAccessCodeRedemption = {
  code: string;
  label: string;
  redeemedAt: string;
};

export type AdminUserDetail = AdminUserListItem & {
  subscription: AdminUserSubscriptionDetail | null;
  institution: AdminUserInstitutionDetail | null;
  accessCodeRedemptions: AdminAccessCodeRedemption[];
};

export type AdminUserFilters = {
  search?: string;
  role?: AdminUserRole;
  planStatus?: "free" | "active" | "trialing" | "past_due" | "canceled" | "incomplete";
};
