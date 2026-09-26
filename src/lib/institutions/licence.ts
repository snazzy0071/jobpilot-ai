// The one definition of "is this licence in force right now", mirrored by the database (enforce_institution_seat_capacity and
// get_institution_licence_plan, migration 0119): switched on, started, and not yet expired.

export type LicenceState = "active" | "expired" | "scheduled" | "inactive";

export const EXPIRY_WARNING_DAYS = 30;

export const LICENCE_STATE_LABELS: Record<LicenceState, string> = {
  active: "Active",
  expired: "Expired",
  scheduled: "Starts later",
  inactive: "Deactivated",
};

export function licenceState(licence: { isActive: boolean; startsAt: string; expiresAt: string | null }, now: Date = new Date()): LicenceState {
  if (!licence.isActive) return "inactive";
  if (new Date(licence.startsAt) > now) return "scheduled";
  if (licence.expiresAt && new Date(licence.expiresAt) <= now) return "expired";
  return "active";
}

/** Whole days left on an active licence (rounded up), or null when it has no end date or isn't active. */
export function daysUntilExpiry(licence: { isActive: boolean; startsAt: string; expiresAt: string | null }, now: Date = new Date()): number | null {
  if (licenceState(licence, now) !== "active" || !licence.expiresAt) return null;
  return Math.ceil((new Date(licence.expiresAt).getTime() - now.getTime()) / 86_400_000);
}

/** The end of the chosen calendar day, UTC: "expires 31 December" should not cut people off at the start of it. */
export function endOfDayUtc(isoDate: string): string {
  return new Date(`${isoDate}T23:59:59.999Z`).toISOString();
}

/** Reserved seats: members plus unexpired pending invites. */
export function seatsRemaining(seatCount: number, members: number, pendingInvites: number): number {
  return Math.max(0, seatCount - members - pendingInvites);
}

/** Lowercase, no scheme/path/@; null when it isn't a plausible domain. */
export function normaliseDomain(input: string): string | null {
  const value = input.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (value.length < 3 || value.length > 255) return null;
  return /^(?=.{3,255}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value) ? value : null;
}

/** Free-mail providers: nobody can claim these as "their" institution's domain. */
export const PUBLIC_MAIL_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "live.co.uk", "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "msn.com", "btinternet.com", "sky.com",
]);

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, premium: 2, elite: 3 };

/**
 * Which plan applies when someone has both their own and one through their institution: the higher tier wins, and a tie goes to
 * their own (so nothing about their billing changes). An unknown plan slug ranks above free but below the named paid tiers.
 */
export function institutionPlanWins(personalSlug: string, licenceSlug: string): boolean {
  const rank = (slug: string) => PLAN_RANK[slug] ?? 0.5;
  return rank(licenceSlug) > rank(personalSlug);
}
